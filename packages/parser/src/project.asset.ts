import { Pathy, pathy } from '@bscotch/pathy';
import {
  Yy,
  YyDataStrict,
  YyResourceType,
  YySchemas,
  YypResource,
  yySchemas,
} from '@bscotch/yy';
import { ok } from 'assert';
import { Code } from './project.code.js';
import { Project } from './project.js';
import { PrimitiveName } from './project.primitives.js';
import { Symbol } from './project.symbol.js';
import { StructType } from './project.type.js';

export class Asset<T extends YyResourceType = YyResourceType> {
  readonly $tag = 'Asset';
  readonly assetType: T;
  readonly gmlFiles: Map<string, Code> = new Map();
  yy!: YyDataStrict<T>;
  readonly yyPath: Pathy<YySchemas[T]>;
  readonly symbol: Symbol;
  /**
   * For objects, their instance type. */
  readonly instanceType: StructType | undefined;

  protected constructor(
    readonly project: Project,
    readonly resource: YypResource,
    yyPath: Pathy,
  ) {
    this.assetType = resource.id.path.split(/[/\\]/)[0] as T;
    this.yyPath = yyPath.withValidator(yySchemas[this.assetType]) as any;
    this.symbol = new Symbol(this.name);
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
    this.yy = await Yy.read(asPath.absolute, this.assetType);
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
      new Code(this as Asset<'scripts' | 'objects'>, path);
    this.gmlFiles.set(path.absolute, gml);
  }

  protected async load() {
    // Find all immediate children, which might include legacy GML files
    const [, children] = await Promise.all([
      await this.readYy(),
      this.dir.listChildren(),
    ]);
    if (this.assetType === 'scripts') {
      this.addScriptFile(children as Pathy<string>[]);
    } else if (this.assetType === 'objects') {
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
    const parseWaits: Promise<any>[] = [];
    for (const file of this.gmlFilesArray) {
      parseWaits.push(file.parse());
    }
    return await Promise.all(parseWaits);
  }

  static async from<T extends YyResourceType>(
    project: Project,
    resource: YypResource,
    yyPath: Pathy,
  ): Promise<Asset<T>> {
    const item = new Asset(project, resource, yyPath) as Asset<T>;
    await item.load();
    // Setting the asset type depends on the GML Spec having been
    // loaded, so we do it after the other stuff and ensure that
    // the spec has been fully loaded
    await item.project.nativeWaiter;
    let assetType: PrimitiveName;
    switch (item.assetType) {
      case 'objects':
        assetType = 'Asset.GMObject';
        break;
      case 'rooms':
        assetType = 'Asset.GMRoom';
        break;
      case 'scripts':
        assetType = 'Asset.GMScript';
        break;
      case 'sprites':
        assetType = 'Asset.GMSprite';
        break;
      case 'sounds':
        assetType = 'Asset.GMSound';
        break;
      case 'paths':
        assetType = 'Asset.GMPath';
        break;
      case 'shaders':
        assetType = 'Asset.GMShader';
        break;
      case 'timelines':
        assetType = 'Asset.GMTimeline';
        break;
      case 'fonts':
        assetType = 'Asset.GMFont';
        break;
      default:
        assetType = 'Unknown';
    }
    item.symbol.addType(item.project.native.types.get(assetType)!);

    // If we are not a script, add ourselves to the global symbols.
    if (item.assetType !== 'scripts') {
      item.project.addGlobal(item.symbol);
    }
    return item;
  }
}
