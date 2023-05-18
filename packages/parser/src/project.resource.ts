import { Pathy, pathy } from '@bscotch/pathy';
import {
  Yy,
  YyResourceType,
  YySchemas,
  YypResource,
  yySchemas,
  type YyDataStrict,
} from '@bscotch/yy';
import { ok } from 'assert';
import { GmlFile } from './project.gml.js';
import type { GameMakerProjectParser } from './project.js';
import { Location } from './project.locations.js';
import { GlobalSelf, InstanceSelf } from './project.selfs.js';

export class GameMakerResource<T extends YyResourceType = YyResourceType> {
  readonly kind = 'resource';
  readonly type: T;
  readonly gmlFiles: Map<string, GmlFile> = new Map();
  yy!: YyDataStrict<T>;
  readonly yyPath: Pathy<YySchemas[T]>;
  self!: T extends 'objects'
    ? InstanceSelf
    : T extends 'scripts'
    ? GlobalSelf
    : undefined;

  protected constructor(
    readonly project: GameMakerProjectParser,
    readonly resource: YypResource,
    yyPath: Pathy,
  ) {
    this.type = resource.id.path.split(/[/\\]/)[0] as T;
    this.yyPath = yyPath.withValidator(yySchemas[this.type]) as any;
  }

  /**
   * Get the first GML file belonging to this resource.
   * For scripts, this is the *only* GML file.*/
  get gmlFile() {
    return this.gmlFilesArray[0];
  }

  get gmlFilesArray() {
    return [...this.gmlFiles.values()].sort((a, b) => {
      if (a.name === 'Create_0') {
        return -1;
      } else if (b.name === 'Create_0') {
        return 1;
      }
      return 0;
    });
  }

  protected async readYy(): Promise<YyDataStrict<T>> {
    let asPath: Pathy | undefined = pathy(this.yyPath);
    if (!(await asPath.exists())) {
      const filePattern = new RegExp(`${this.name}\\.yy$`, 'i');
      const paths = await pathy(this.dir).listChildren();
      asPath = paths.find((x) => filePattern.test(x.basename));
    }
    ok(asPath, `Could not find a .yy file for ${this.name}`);
    this.yy = await Yy.read(asPath.absolute, this.type);
    return this.yy;
  }

  /** The folder path this asset lives in within the GameMaker IDE virtual asset tree. */
  get virtualFolder() {
    return this.resource.id.path.replace(/^folders[/\\]+(.+)\.yy$/, '$1');
  }

  get dir() {
    return this.yyPath.up();
  }

  get name() {
    return this.resource.id.name;
  }

  /**
   * Reprocess an existing file after it has been modified.
   */
  async reloadFile(path: Pathy, virtualContent?: string) {
    const gml = this.getGmlFile(path);
    if (!gml) {
      return;
    }
    await gml.reload(virtualContent);
  }

  getGmlFile(path: Pathy) {
    return this.gmlFiles.get(path.absolute);
  }

  updateGlobals() {
    for (const gml of this.gmlFilesArray) {
      gml.updateGlobals();
    }
  }

  updateAllSymbols() {
    for (const gml of this.gmlFilesArray) {
      gml.updateAllSymbols();
    }
  }

  protected addGmlFile(path: Pathy<string>) {
    const gml =
      this.getGmlFile(path) ||
      new GmlFile(this as GameMakerResource<'scripts' | 'objects'>, path);
    this.gmlFiles.set(path.absolute, gml);
  }

  protected async load() {
    // Find all immediate children, which might include legacy GML files
    const [, children] = await Promise.all([
      await this.readYy(),
      this.dir.listChildren(),
    ]);
    if (this.type === 'scripts') {
      this.addScriptFile(children as Pathy<string>[]);
    } else if (this.type === 'objects') {
      this.addObjectFile(children as Pathy<string>[]);
    }
    await this.initiallyReadAndParseGml();
  }

  onRemove() {
    this.gmlFiles.forEach((gml) => gml.onRemove());
  }

  protected addObjectFile(children: Pathy<string>[]) {
    // Objects have one file per event, named after the event.
    // The YY file includes the list of events, but references them by
    // numeric identifiers instead of their name. For now we'll just
    // assume that the GML files are correct.
    children
      .filter((p) => p.hasExtension('gml'))
      .forEach((p) => this.addGmlFile(p));
  }

  protected addScriptFile(children: Pathy<string>[]) {
    // Scripts should have exactly one GML file, which is the script itself,
    // named the same as the script (though there could be casing variations)
    const matches = children.filter(
      (p) =>
        p.basename.toLocaleLowerCase() ===
        `${this.name.toLocaleLowerCase()}.gml`,
    );
    if (matches.length !== 1) {
      console.error(
        `Script ${this.name} has ${matches.length} GML files. Expected 1.`,
      );
    } else {
      this.addGmlFile(matches[0]);
    }
  }

  protected async initiallyReadAndParseGml() {
    const startLocation = new Location(this.gmlFile, { startOffset: 0 });
    this.self = (
      this.type === 'objects'
        ? new InstanceSelf(this.name, startLocation)
        : this.type === 'scripts'
        ? this.project.self
        : undefined
    ) as any;
    // If we are not a script, add ourselves to the global self.
    if (this.self && !(this.self instanceof GlobalSelf)) {
      this.project.self.addSymbol(this.self);
    }

    const parseWaits: Promise<any>[] = [];
    for (const file of this.gmlFilesArray) {
      parseWaits.push(file.parse());
    }
    return await Promise.all(parseWaits);
  }

  static async from<T extends YyResourceType>(
    project: GameMakerProjectParser,
    resource: YypResource,
    yyPath: Pathy,
  ): Promise<GameMakerResource<T>> {
    const item = new GameMakerResource(project, resource, yyPath);
    await item.load();
    return item as any;
  }
}
