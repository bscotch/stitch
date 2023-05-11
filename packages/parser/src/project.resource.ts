import { Pathy, pathy } from '@bscotch/pathy';
import {
  Yy,
  YyResourceType,
  YypResource,
  yySchemas,
  type YyDataStrict,
} from '@bscotch/yy';
import { ok } from 'assert';
import { GmlFile } from './project.gml.js';
import type { GameMakerProjectParser } from './project.js';
import { AssetSelf, GlobalSelf, InstanceSelf } from './symbols.self.js';

export class GameMakerResource<T extends YyResourceType = YyResourceType> {
  readonly kind = 'resource';
  readonly type: T;
  readonly gmlFiles: Map<string, GmlFile> = new Map();
  yy!: YyDataStrict<T>;
  readonly self: T extends 'objects'
    ? InstanceSelf
    : T extends 'scripts'
    ? GlobalSelf
    : AssetSelf;

  protected constructor(
    readonly project: GameMakerProjectParser,
    readonly resource: YypResource,
  ) {
    this.type = resource.id.path.split(/[/\\]/)[0] as T;
    this.self = (
      this.type === 'objects'
        ? new InstanceSelf(this.name)
        : this.type === 'scripts'
        ? this.project.self
        : new AssetSelf(this.name)
    ) as any;
    // If we are not a script, add ourselves to the global self.
    if (!(this.self instanceof GlobalSelf)) {
      this.project.self.addSymbol(this.self);
    }
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

  get yyPath() {
    return this.project.projectDir
      .join(this.resource.id.path)
      .withValidator(yySchemas[this.type]);
  }

  get dir() {
    return this.yyPath.up();
  }

  get name() {
    return this.resource.id.name;
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

  protected async loadGml(path: Pathy<string>): Promise<GmlFile> {
    const gml =
      this.gmlFiles.get(path.name) ||
      new GmlFile(this as GameMakerResource<'scripts' | 'objects'>, path);
    this.gmlFiles.set(path.name, gml);
    await gml.parse(path);
    return gml;
  }

  protected async load() {
    const waits: Promise<any>[] = [];
    this.gmlFiles.clear();
    // Find all immediate children, which might include legacy GML files
    const [, children] = await Promise.all([
      await this.readYy(),
      this.dir.listChildren(),
    ]);
    if (this.type === 'scripts') {
      await this.loadScriptGml(children as Pathy<string>[]);
    } else if (this.type === 'objects') {
      await this.loadObjectGml(children as Pathy<string>[]);
    }
    await Promise.all(waits);
  }

  protected async loadObjectGml(children: Pathy<string>[]) {
    // Objects have one file per event, named after the event.
    // The YY file includes the list of events, but references them by
    // numeric identifiers instead of their name. For now we'll just
    // assume that the GML files are correct.
    const gmlFiles = children
      .filter((p) => p.hasExtension('gml'))
      .map((p) => this.loadGml(p));
    await Promise.all(gmlFiles);
  }

  protected async loadScriptGml(children: Pathy<string>[]) {
    // Scripts should have exactly one GML file, which is the script itself,
    // named the same as the script (though there could be casing variations)
    const matches = children.filter(
      (p) =>
        p.basename.toLocaleLowerCase() ===
        `${this.name.toLocaleLowerCase()}.gml`,
    );
    if (matches.length !== 1) {
      this.project.emitWarning(
        `Script ${this.name} has ${matches.length} GML files. Expected 1.`,
      );
    } else {
      await this.loadGml(matches[0]);
    }
  }

  static async from<T extends YyResourceType>(
    project: GameMakerProjectParser,
    resource: YypResource,
  ): Promise<GameMakerResource<T>> {
    const item = new GameMakerResource(project, resource);
    await item.load();
    return item as any;
  }
}
