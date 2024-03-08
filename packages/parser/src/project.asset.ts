import { Pathy, pathy } from '@bscotch/pathy';
import { sequential } from '@bscotch/utility';
import {
  Yy,
  YyDataStrict,
  YyExtension,
  YyObject,
  YyResourceType,
  YyRoom,
  YyRoomInstanceLayer,
  YySchemas,
  YySound,
  YySprite,
  YypResource,
  yyObjectEventSchema,
  yyRoomInstanceLayerSchema,
  yyRoomInstanceSchema,
  yySchemas,
  yySpriteSchema,
} from '@bscotch/yy';
import type { ObjectEvent, ObjectEventName } from './lib.objects.js';
import { logger } from './logger.js';
import { Code } from './project.code.js';
import { Diagnostic } from './project.diagnostics.js';
import { Project } from './project.js';
import { Signifier } from './signifiers.js';
import { StructType, Type } from './types.js';
import { assert, getPngSize, groupPathToPosix, ok } from './util.js';

export function isAssetOfKind<T extends YyResourceType>(
  asset: any,
  kind: T,
): asset is Asset<T> {
  return (
    asset !== null && typeof asset === 'object' && asset.assetKind === kind
  );
}

export function assertIsAssetOfKind<T extends YyResourceType>(
  asset: any,
  kind: T,
): asserts asset is Asset<T> {
  assert(isAssetOfKind(asset, kind), `Expected asset to be of kind ${kind}`);
}

export class Asset<T extends YyResourceType = YyResourceType> {
  readonly $tag = 'Asset';
  readonly assetKind: T;
  readonly gmlFiles: Map<string, Code> = new Map();
  yy!: YyDataStrict<T>;
  readonly yyPath: Pathy<YySchemas[T]>;
  readonly signifier: Signifier;
  /** For objects, their instance type. */
  instanceType: Type<'Id.Instance'> | undefined;
  assetType: Type<Asset['assetTypeKind']>;
  variables: StructType | undefined;
  nativeVariables: StructType | undefined;

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
    this.assetType = new Type(this.assetTypeKind).named(this.name);
    this.signifier.setType(this.assetType);
    this.assetType.signifier = this.signifier;

    // Add this asset to the project lookup, unless it is a script.
    if (!['scripts', 'extensions'].includes(this.assetKind)) {
      this.project.self.addMember(this.signifier);
      if (this.assetType.kind !== 'Any') {
        this.project.types.set(this.typeName, this.assetType);
      }
    }

    // If this is an object, also create the instance type
    if (this.assetKind === 'objects') {
      this.nativeVariables = Type.Struct;
      // Create the base struct-type to store all of the variables.
      for (const member of this.project.native.objectInstanceBase.listMembers()) {
        if (member.name === 'id') continue; // This is added later
        const copy = member.copy();
        copy.override = true; // Guarantee we keep this as a copy
        this.nativeVariables.addMember(copy);
      }

      this.variables = new Type('Struct');
      this.variables.extends = this.nativeVariables;
      this.variables.signifier = this.signifier;

      // It will be used as the parent for the Instance/Asset types
      this.assetType.extends = this.variables;

      this.instanceType = new Type('Id.Instance').named(this.name);
      this.instanceType.extends = this.variables;
      this.instanceType.signifier = this.signifier;
      const id = new Signifier(this.variables, 'id', this.instanceType);
      id.instance = true;
      id.native = 'Base';
      id.writable = false;
      id.override = true; // We are guaranteeing that we're using

      this.variables.addMember(id)!;

      this.project.types.set(this.instanceTypeName, this.instanceType);
    }
  }

  get typeName() {
    return `${this.assetType.kind}.${this.name}`;
  }

  get instanceTypeName() {
    return `Id.Instance.${this.name}`;
  }

  @sequential
  async saveYy() {
    assert(this.yyPath, 'Cannot save YY without a path');
    await Yy.write(
      this.yyPath.absolute,
      this.yy,
      this.assetKind,
      this.project.yyp,
    );
  }

  get isScript() {
    return this.assetKind === 'scripts';
  }

  get isObject() {
    return this.assetKind === 'objects';
  }

  get isSound() {
    return this.assetKind === 'sounds';
  }

  get isRoom() {
    return this.assetKind === 'rooms';
  }

  get isSprite() {
    return this.assetKind === 'sprites';
  }

  get isSpineSprite() {
    if (this.assetKind !== 'sprites') {
      return false;
    }
    const yy = this.yy as YySprite;
    return yy.type === 2;
  }

  get soundFile(): Pathy<Buffer> {
    assert(
      isAssetOfKind(this, 'sounds'),
      'Can only get sound files from sound assets',
    );
    const yy = this.yy as YySound;
    return this.dir.join(yy.soundFile);
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
  set sprite(sprite: Asset<'sprites'> | undefined) {
    assert(isAssetOfKind(this, 'objects'), 'Can only set sprites on objects');
    const yy = this.yy as YyObject;
    yy.spriteId = sprite ? sprite.resource.id : null;
    // Fire off async to avoid blocking
    void this.saveYy();
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
    const oldParent = this._parent;
    if (oldParent === parent) {
      // No change!
      return;
    }
    this._parent = parent;
    if (parent) {
      // The instanceType parent is a struct that holds all of this
      // object's instance variables. We need to set ITS parent to
      // the parent's instanceType.
      this.variables!.extends = parent.variables;
    } else {
      this.variables!.extends = this.nativeVariables;
    }
    // Do we need to change the yy file?
    const yy = this.yy as YyObject;
    const parentFromYy = this.project.getAssetByName(yy.parentObjectId?.name);
    if (parentFromYy !== parent) {
      // Then we need to update the yy. Just fire it off async for now so
      // that this function can remain synchronous.
      if (!parent) {
        yy.parentObjectId = null;
      } else {
        yy.parentObjectId = parent.resource.id;
      }
      // TODO: Maybe reprocess?
      this.updateDiagnostics();
      void this.saveYy();
    }
  }

  /**
   * Get the entire parent heirarchy, with immediate first
   * and most-distant last
   */
  get parents(): Asset<'objects'>[] {
    if (!this.parent) {
      return [];
    }
    return [this.parent, ...this.parent.parents];
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

  get roomInstances(): { instanceId: string; object: Asset<'objects'> }[] {
    assertIsAssetOfKind(this, 'rooms');
    const instances = new Map<string, Asset<'objects'>>();
    // Loop through each instance layer's instances to get IDs and objects
    const yy = this.yy as YyRoom;
    for (const layer of (yy as YyRoom).layers) {
      if (layer.resourceType !== 'GMRInstanceLayer') {
        continue;
      }
      for (const instance of (layer as YyRoomInstanceLayer).instances || []) {
        const obj = this.project.getAssetByName(instance.objectId.name);
        if (isAssetOfKind(obj, 'objects')) {
          instances.set(instance.name, obj);
        }
      }
    }
    // Loop through the instance order to get everything in the expected order
    return yy.instanceCreationOrder
      .map((x) => ({
        instanceId: x.name,
        object: instances.get(x.name)!,
      }))
      .filter((x) => !!x.object);
  }

  get frameIds(): string[] {
    if (this.assetKind !== 'sprites') {
      return [];
    }
    const yy = this.yy as YySprite;
    return yy.frames.map((f) => f.name);
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

  get spinePaths() {
    if (!this.isSpineSprite) {
      return undefined;
    }
    const yy = this.yy as YySprite;
    const frameId = yy.frames?.[0].name;
    if (!frameId) {
      return undefined;
    }
    return {
      json: this.dir.join(`${frameId}.json`),
      atlas: this.dir.join(`${frameId}.atlas`),
    };
  }

  @sequential
  async removeRoomInstance(instanceId: string) {
    assert(this.isRoom, 'Can only add object instances to rooms');
    const yy = this.yy as YyRoom;
    // Iterate through each instance layer and remove any instances with the given ID
    for (const layer of yy.layers) {
      if (layer.resourceType !== 'GMRInstanceLayer') {
        continue;
      }
      layer.instances = (layer.instances || []).filter(
        (x) => x.name !== instanceId,
      );
    }
    // Remove the instance from the creation order
    yy.instanceCreationOrder = (yy.instanceCreationOrder || []).filter(
      (x) => x.name !== instanceId,
    );
    await this.saveYy();
  }

  @sequential
  async reorganizeRoomInstances(instanceIds: string[]) {
    assert(this.isRoom, 'Can only add object instances to rooms');
    const instanceIdsSet = new Set(instanceIds);
    assert(
      instanceIds.length === instanceIdsSet.size,
      'Cannot have duplicate instance IDs',
    );
    const yy = this.yy as YyRoom;
    const currentIds = new Set(yy.instanceCreationOrder.map((x) => x.name));
    // Ensure that the new order includes all existing instances
    assert(
      instanceIdsSet.size === currentIds.size &&
        [...instanceIdsSet].every((x) => currentIds.has(x)),
      'New order must include all existing instances',
    );
    yy.instanceCreationOrder = instanceIds.map((name) => ({
      name,
      path: `rooms/${this.name}/${this.name}.yy`,
    }));
    await this.saveYy();
  }

  @sequential
  async addRoomInstance(obj: Asset<'objects'>, x = 0, y = 0) {
    assert(this.isRoom, 'Can only add object instances to rooms');
    const yy = this.yy as YyRoom;
    // Ensure we have an instance layer
    let instanceLayer = yy.layers.find(
      (x) => x.resourceType === 'GMRInstanceLayer',
    ) as YyRoomInstanceLayer | undefined;
    if (!instanceLayer) {
      instanceLayer = yyRoomInstanceLayerSchema.parse({});
      yy.layers.unshift(instanceLayer);
    }
    // Add a new instance
    const instance = yyRoomInstanceSchema.parse({
      objectId: obj.resource.id,
      x,
      y,
    });
    instanceLayer.instances.push(instance);
    yy.instanceCreationOrder ||= [];
    yy.instanceCreationOrder.push({
      name: instance.name,
      path: `rooms/${this.name}/${this.name}.yy`,
    });
    await this.saveYy();
  }

  get folder() {
    return groupPathToPosix((this.yy.parent as any).path);
  }

  /**
   * Check if this asset is in the given asset group ("folder").
   * @param path E.g. `my/folder/of/stuff`
   */
  isInFolder(path: string) {
    // Normalize the incoming path
    path = groupPathToPosix(path);
    const currentFolder = this.folder;
    return path === currentFolder || currentFolder.startsWith(`${path}/`);
  }

  /** Move to a different, *existing* folder. */
  async moveToFolder(path: string) {
    assert(path, 'Must provide a path with non-zero length!');
    if (!path.endsWith('.yy')) {
      path = `folders/${path}.yy`;
    }
    const folderName = path
      .split(/[/\\]+/)
      .pop()!
      .replace(/\.yy$/, '');
    // Make sure that folder exists.
    assert(folderName, 'Folder name is empty');
    assert(
      this.project.yyp.Folders.find((x) => x.folderPath === path),
      `Folder ${path} does not exist`,
    );
    assert(this.yy.parent, 'Asset has no folder field');
    // @ts-expect-error
    logger.info('moving', this.name, 'from', this.yy.parent.path, 'to', path);
    this.yy.parent = { name: folderName, path };
    await this.saveYy();
  }

  /**
   * Re-order the existing frames of a sprite.
   * Any frames not included in the new order will be deleted.
   */
  @sequential
  async reorganizeFrames(newFrameIdOrder: string[]) {
    assert(this.isSprite, 'Can only delete frames from a sprite');
    assert(!this.isSpineSprite, 'Cannot delete frames from a Spine sprite');
    if (!newFrameIdOrder.length) return;
    let yy = this.yy as YySprite;
    const oldFrameIds = yy.frames.map((x) => x.name);
    assert(
      newFrameIdOrder.every((x) => oldFrameIds.includes(x)),
      "Can't reorder frames that don't exist",
    );
    yy.frames = newFrameIdOrder.map((frameId) => {
      const oldFrame = yy.frames.find((x) => x.name === frameId);
      assert(oldFrame, 'Frame not found');
      return oldFrame;
    });
    await this.saveYy();
    // Delete any old frame images
    await Promise.all(
      oldFrameIds
        .filter((x) => !newFrameIdOrder.includes(x))
        .map((frameId) => {
          const path = this.dir.join(`${frameId}.png`);
          return path.delete();
        }),
    );
  }

  @sequential
  async deleteFrames(frameIds: string[]) {
    assert(this.isSprite, 'Can only delete frames from a sprite');
    assert(!this.isSpineSprite, 'Cannot delete frames from a Spine sprite');
    if (!frameIds.length) return;
    let yy = this.yy as YySprite;
    yy.frames = yy.frames.filter((x) => !frameIds.includes(x.name));
    await this.saveYy();

    // TODO: Delete the image files
    await Promise.all(
      frameIds.map((frameId) => {
        const path = this.dir.join(`${frameId}.png`);
        return path.delete();
      }),
    );
  }

  @sequential
  async addFrames(sourceImages: Pathy[]) {
    assert(this.isSprite, 'Can only add frames to a sprite');
    assert(!this.isSpineSprite, 'Cannot add frames to a Spine sprite');
    if (!sourceImages.length) return;
    assert(
      sourceImages.every((x) => x.hasExtension('png')),
      'All frames must be PNGs',
    );
    let yy = this.yy as YySprite;
    let expectedDims: { width: number; height: number };
    if (!yy.frames.length) {
      // Then get the expected dimensions from the first image
      expectedDims = await getPngSize(sourceImages[0]);
    } else {
      expectedDims = {
        width: yy.width,
        height: yy.height,
      };
    }
    const frameSizes = await Promise.all(
      sourceImages.map((x) => getPngSize(x)),
    );
    assert(
      frameSizes.every(
        (x) =>
          x.width === expectedDims.width && x.height === expectedDims.height,
      ),
      `Expected all frames to have width ${expectedDims.width} and height ${expectedDims.height}`,
    );
    const startingFrameCount = yy.frames.length;
    // Update the YY file to get new frameIds
    yy.frames.length = startingFrameCount + sourceImages.length;
    yy = yySpriteSchema.parse(yy); // Will fill out the new frames
    // Copy the new frames over.
    await Promise.all(
      sourceImages.map((source, i) => {
        const dest = this.dir.join(
          `${yy.frames[startingFrameCount + i].name}.png`,
        );
        return source.copy(dest);
      }),
    );
    await this.saveYy();
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

  async readYy(): Promise<YyDataStrict<T>> {
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
    assert(path, 'GML Path does not exist');
    return this.gmlFiles.get(path.absolute.toLocaleLowerCase());
  }

  protected updateParent() {
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
    assert(path, 'Cannot add GML file, path does not exist');
    this.gmlFiles.set(path.absolute.toLocaleLowerCase(), gml);
    return gml;
  }

  async reload() {
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
      const diagnostics: Diagnostic[] = [];

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
            continue;
          }
          try {
            // Get the type by parsing the value. For now we'll just check for number or string, else "Any".
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
          } catch (err) {
            diagnostics.push(
              new Diagnostic(
                `Error loading extension constant: ${constant.name}`,
                {
                  start: { line: 0, column: 0, offset: 0 },
                  end: { line: 0, column: 0, offset: 0 },
                },
                'error',
                err,
              ),
            );
          }
        }
        for (const func of file.functions) {
          if (func.hidden) {
            continue;
          }
          if (this.project.self.getMember(func.externalName)) {
            continue;
          }
          try {
            const type = new Type('Function')
              .named(func.externalName)
              .describe(func.help);
            type.setReturnType(new Type(typeIndexToName(func.returnType)));
            for (let i = 0; i < func.args.length; i++) {
              const typeIdx = func.args[i];
              type.addParameter(i, `argument${i}`, {
                type: new Type(typeIndexToName(typeIdx)),
              });
            }
            const signifier = new Signifier(this.project.self, func.name, type);
            signifier.global = true;
            signifier.writable = false;
            signifier.def = {};
            this.project.self.addMember(signifier);
            this.project.types.set(`Function.${func.externalName}`, type);
          } catch (err) {
            diagnostics.push(
              new Diagnostic(
                `Error loading extension function: ${func.name}`,
                {
                  start: { line: 1, column: 1, offset: 0 },
                  end: { line: 1, column: 1, offset: 0 },
                },
                'error',
                err,
              ),
            );
          }
        }
      }

      this.project.emitDiagnostics(this.yyPath.absolute, diagnostics);
    }
    await this.initiallyReadAndParseGml();
  }

  async onRemove() {
    await Promise.all(this.gmlFilesArray.map((gml) => gml.remove()));
    // Remove this signifier and any global types from the project
    this.project.self.removeMember(this.signifier.name);
    for (const typeName of [this.typeName, this.instanceTypeName]) {
      const type = this.project.types.get(typeName);
      if (type) {
        this.project.types.delete(this.typeName);
        // Try to get any refereneces using this type updated
        for (const ref of type.signifier?.refs || []) {
          ref.file.dirty = true;
        }
      }
    }
    // Remove the associated files
    await this.dir.delete({ force: true, recursive: true });
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
  ): Promise<Asset<T> | undefined> {
    let yyPath: Pathy | undefined = project.dir.join(resource.id.path);
    if (!(await yyPath.exists())) {
      const assetsDir = yyPath.up(2);
      const namePattern = new RegExp(`^${resource.id.name}$`, 'i');
      const dir = (await assetsDir.listChildren()).find((p) =>
        p.basename.match(namePattern),
      );
      if (dir) {
        const yyPattern = new RegExp(`^${resource.id.name}\\.yy$`, 'i');
        yyPath = (await dir.listChildren()).find((p) =>
          p.basename.match(yyPattern),
        );
        if (!yyPath) {
          logger.warn(`Could not find file for "${resource.id.path}"`);
        }
      } else {
        logger.warn(`Could not find folder for "${resource.id.path}"`);
      }
    }
    if (!yyPath) {
      return;
    }
    const item = new Asset(project, resource, yyPath) as Asset<T>;
    await item.reload();

    return item;
  }
}
