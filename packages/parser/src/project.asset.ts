import { Pathy, pathy } from '@bscotch/pathy';
import {
  Yy,
  YyDataStrict,
  YyExtension,
  YyObject,
  YyResourceType,
  YySchemas,
  YySprite,
  YypResource,
  yyObjectEventSchema,
  yySchemas,
} from '@bscotch/yy';
import type { ObjectEvent, ObjectEventName } from './lib.objects.js';
import { logger } from './logger.js';
import { Code } from './project.code.js';
import { Project } from './project.js';
import { Signifier } from './signifiers.js';
import { StructType, Type } from './types.js';
import { assert, ok } from './util.js';

export function isAssetOfKind<T extends YyResourceType>(
  asset: Asset,
  kind: T,
): asset is Asset<T> {
  return asset.assetKind === kind;
}

export class Asset<T extends YyResourceType = YyResourceType> {
  readonly $tag = 'Asset';
  readonly assetKind: T;
  readonly gmlFiles: Map<string, Code> = new Map();
  yy!: YyDataStrict<T>;
  readonly yyPath: Pathy<YySchemas[T]>;
  readonly signifier: Signifier;
  /** For objects, their instance type. */
  instanceType: StructType | undefined;
  /** For objects, their parent */
  protected _parent: Asset<'objects'> | undefined = undefined;

  protected initalized = {
    globals: false,
    locals: false,
  };

  protected constructor(
    readonly project: Project,
    readonly resource: YypResource,
    yyPath: Pathy,
  ) {
    assert(yyPath, 'Must provide a YY path');
    this.assetKind = resource.id.path.split(/[/\\]/)[0] as T;
    this.yyPath = yyPath.withValidator(yySchemas[this.assetKind]) as any;

    // Create the symbol
    this.signifier = new Signifier(this.project.self, this.name);
    this.signifier.def = {};
    this.signifier.global = true;
    this.signifier.asset = true;

    // Create the Asset.<> type
    const type = new Type(this.assetTypeKind).named(this.name);
    this.signifier.setType(type);

    // Add this asset to the project lookup, unless it is a script.
    if (!['scripts', 'extensions'].includes(this.assetKind)) {
      this.project.self.addMember(this.signifier);
      if (type.kind !== 'Any') {
        this.project.types.set(`${type.kind}.${this.name}`, type);
      }
    }

    // If this is an object, also create the instance type
    if (this.assetKind === 'objects') {
      this.instanceType = this.project
        .createStructType('instance')
        .named(this.name);
      const id = this.instanceType.addMember('id', this.instanceType);
      id.instance = true;
      id.def = {};
      id.writable = false;
      this.instanceType.signifier = this.signifier;
      this.project.types.set(`Id.Instance.${this.name}`, this.instanceType);
    }
  }

  async saveYy() {
    await Yy.write(this.yyPath.absolute, this.yy, this.assetKind);
  }

  get isScript() {
    return this.assetKind === 'scripts';
  }

  get isObject() {
    return this.assetKind === 'objects';
  }

  get sprite(): Asset<'sprites'> | undefined {
    assert(isAssetOfKind(this, 'objects'), 'Can only get sprites from objects');
    const yy = this.yy as YyObject;
    const spriteName = yy.spriteId?.name;
    const sprite = spriteName
      ? this.project.getAssetByName(spriteName)
      : undefined;
    if (spriteName && !sprite) {
      logger.warn(`Sprite ${spriteName} has no asset`);
    }
    return sprite as Asset<'sprites'> | undefined;
  }

  get children(): Asset<'objects'>[] {
    assert(isAssetOfKind(this, 'objects'), 'Can only get children of objects');
    const children: Asset<'objects'>[] = [];
    for (const asset of this.project.assets.values()) {
      if (isAssetOfKind(asset, 'objects') && asset.parent === this) {
        children.push(asset);
      }
    }
    return children;
  }

  get parent() {
    return this._parent;
  }
  set parent(parent: Asset<'objects'> | undefined) {
    this._parent = parent;
    if (parent) {
      this.instanceType!.parent = parent.instanceType;
    } else {
      this.instanceType!.parent = undefined;
    }
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

  getEventByName(name: ObjectEventName): Code | undefined {
    assert(this.isObject, 'Can only get events for objects');
    return this.gmlFilesArray.find((gml) => gml.name === name);
  }

  get shaderPaths(): T extends 'shaders'
    ? { [K in 'vertex' | 'fragment']: Pathy<string> }
    : undefined {
    if (this.assetKind !== 'shaders') {
      return undefined as any;
    }
    return {
      vertex: this.yyPath.changeExtension('vsh'),
      fragment: this.yyPath.changeExtension('fsh'),
    } as any;
  }

  get framePaths(): Pathy<Buffer>[] {
    const paths: Pathy<Buffer>[] = [];
    if (this.assetKind !== 'sprites') {
      return paths;
    }
    const yy = this.yy as YySprite;
    for (const frame of yy.frames || []) {
      paths.push(this.dir.join<Buffer>(`${frame.name}.png`));
    }
    return paths;
  }

  async createEvent(eventInfo: ObjectEvent) {
    assert(this.isObject, 'Can only create events for objects');
    // Create the file if it doesn't already exist
    const path = this.dir.join<string>(`${eventInfo.name}.gml`);
    if (!(await path.exists())) {
      await path.write('/// ');
    }
    // Update the YY file
    const yy = this.yy as YyObject;
    yy.eventList ||= [];
    if (
      yy.eventList.find(
        (x) =>
          x.eventNum === eventInfo.eventNum &&
          x.eventType === eventInfo.eventType,
      )
    ) {
      logger.warn(`Event ${eventInfo.name} already exists on ${this.name}`);
      return;
    }
    yy.eventList.push(
      yyObjectEventSchema.parse({
        eventNum: eventInfo.eventNum,
        eventType: eventInfo.eventType,
      }),
    );
    await this.saveYy();
    return this.addGmlFile(path);
  }

  protected async readYy(): Promise<YyDataStrict<T>> {
    let asPath: Pathy | undefined = pathy(this.yyPath);
    if (!(await asPath.exists())) {
      const filePattern = new RegExp(`${this.name}\\.yy$`, 'i');
      const paths = await pathy(this.dir).listChildren();
      asPath = paths.find((x) => filePattern.test(x.basename));
    }
    ok(asPath, `Could not find a .yy file for ${this.name}`);
    this.yy = await Yy.read(asPath.absolute, this.assetKind);
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
    await gml.reload(virtualContent, { reloadDirty: true });
  }

  getGmlFile(path: Pathy) {
    return this.gmlFiles.get(path.absolute);
  }

  updateParent() {
    if (this.assetKind !== 'objects') {
      return;
    }
    const yy = this.yy as YyObject;
    if (!yy.parentObjectId) {
      return;
    }
    const parent = this.project.getAssetByName(yy.parentObjectId.name);
    if (!parent || parent.assetKind !== 'objects') {
      // TODO: Add diagnostic if parent missing
      return;
    }
    // Set the parent
    this.parent = parent as Asset<'objects'>;
  }

  updateGlobals(initial = false) {
    this.updateParent();
    // Ensure parent is updated first
    if (initial && !this.initalized.globals && this.parent) {
      this.parent.updateGlobals(initial);
    } else if (initial && this.initalized.globals) {
      // Already initialized by a child
      return;
    }
    for (const gml of this.gmlFilesArray) {
      gml.updateGlobals();
    }
    this.initalized.globals = true;
  }

  updateAllSymbols(initial = false) {
    // Ensure parent is updated first
    if (initial && !this.initalized.locals && this.parent) {
      this.parent.updateAllSymbols(initial);
    } else if (initial && this.initalized.locals) {
      // Already initialized by a child
      return;
    }
    for (const gml of this.gmlFilesArray) {
      gml.updateAllSymbols();
    }
    this.initalized.locals = true;
  }

  updateDiagnostics() {
    for (const gml of this.gmlFilesArray) {
      gml.updateDiagnostics();
    }
  }

  protected addGmlFile(path: Pathy<string>): Code {
    const gml =
      this.getGmlFile(path) ||
      new Code(this as Asset<'scripts' | 'objects'>, path);
    this.gmlFiles.set(path.absolute, gml);
    return gml;
  }

  protected async load() {
    // Find all immediate children, which might include legacy GML files
    const [, children] = await Promise.all([
      await this.readYy(),
      this.dir.listChildren(),
    ]);
    if (this.assetKind === 'scripts') {
      this.addScriptFile(children as Pathy<string>[]);
    } else if (this.assetKind === 'objects') {
      this.addObjectFile(children as Pathy<string>[]);
    } else if (this.assetKind === 'extensions') {
      // Load constants and functions from the extension
      const typeIndexToName = (idx: 1 | 2): 'String' | 'Real' => {
        return idx === 1 ? 'String' : 'Real';
      };

      const yy = this.yy as YyExtension;
      for (const file of yy.files) {
        for (const constant of file.constants) {
          if (constant.hidden) {
            continue;
          }
          if (this.project.self.getMember(constant.name)) {
            logger.warn(
              `Constant ${constant.name} from extension ${this.name} already exists`,
            );
            continue;
          }
          // TODO: Get the type by parsing the value. For now we'll just check for number or string, else "Any".
          const type = constant.value.startsWith('"')
            ? 'String'
            : constant.value.match(/^-?[\d_.]+$/)
            ? 'Real'
            : 'Any';
          const signifier = new Signifier(
            this.project.self,
            constant.name,
            new Type(type),
          );
          signifier.macro = true;
          signifier.global = true;
          signifier.writable = false;
          signifier.def = {};

          this.project.self.addMember(signifier);
        }
        for (const func of file.functions) {
          if (func.hidden) {
            continue;
          }
          if (this.project.self.getMember(func.externalName)) {
            logger.warn(
              `Constant ${func.externalName} from extension ${this.name} already exists`,
            );
            continue;
          }
          const type = new Type('Function')
            .named(func.externalName)
            .describe(func.help);
          type.setReturnType(new Type(typeIndexToName(func.returnType)));
          for (let i = 0; i < func.args.length; i++) {
            const typeIdx = func.args[i];
            type.addParameter(
              i,
              `argument${i}`,
              new Type(typeIndexToName(typeIdx)),
            );
          }
          const signifier = new Signifier(this.project.self, func.name, type);
          signifier.global = true;
          signifier.writable = false;
          signifier.def = {};
          this.project.self.addMember(signifier);
          this.project.types.set(`Function.${func.externalName}`, type);
        }
      }
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
        `${this.name?.toLocaleLowerCase?.()}.gml`,
    );
    if (matches.length !== 1) {
      logger.error(
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

  get assetTypeKind() {
    switch (this.assetKind) {
      case 'objects':
        return 'Asset.GMObject';
      case 'rooms':
        return 'Asset.GMRoom';
      case 'scripts':
        return 'Asset.GMScript';
      case 'sprites':
        return 'Asset.GMSprite';
      case 'sounds':
        return 'Asset.GMSound';
      case 'paths':
        return 'Asset.GMPath';
      case 'shaders':
        return 'Asset.GMShader';
      case 'timelines':
        return 'Asset.GMTimeline';
      case 'fonts':
        return 'Asset.GMFont';
      default:
        return 'Any';
    }
  }

  static async from<T extends YyResourceType>(
    project: Project,
    resource: YypResource,
    yyPath: Pathy,
  ): Promise<Asset<T>> {
    const item = new Asset(project, resource, yyPath) as Asset<T>;
    await item.load();

    return item;
  }
}
