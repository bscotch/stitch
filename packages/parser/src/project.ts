import { pathy, Pathy } from '@bscotch/pathy';
import {
  getDefaultsForNewSound,
  isValidSoundName,
  isValidSpriteName,
  stitchConfigFilename,
  stitchConfigSchema,
  type StitchConfig,
} from '@bscotch/stitch-config';
import { sequential } from '@bscotch/utility';
import {
  SoundChannel,
  SpriteType,
  Yy,
  Yyp,
  yyParentSchema,
  yypFolderSchema,
  yyRoomSchema,
  YySchema,
  YySound,
  yySpriteSchema,
  type YypConfig,
  type YypFolder,
  type YypResource,
} from '@bscotch/yy';
import { EventEmitter } from 'events';
import { logger } from './logger.js';
import { importAssets } from './modules.js';
import { ImportModuleOptions } from './modules.types.js';
import { Asset, isAssetOfKind } from './project.asset.js';
import { Code } from './project.code.js';
import { Diagnostic } from './project.diagnostics.js';
import { Native } from './project.native.js';
import { fshDefault, vshDefault } from './shaderDefaults.js';
import { Signifier } from './signifiers.js';
import { StructType, Type } from './types.js';
import {
  assert,
  assertIsValidIdentifier,
  getPngSize,
  groupPathToPosix,
  ok,
  throwError,
} from './util.js';
export { setLogger, type Logger } from './logger.js';

type AssetName = string;

export interface SymbolInfo {
  native: boolean;
  symbol: Signifier | Type;
}

export interface DiagnosticsEventPayload {
  filePath: string;
  code?: Code;
  diagnostics: Diagnostic[];
}

export type OnDiagnostics = (diagnostics: DiagnosticsEventPayload) => void;

export interface ProjectOptions {
  /**
   * If true, a file watcher will be set up to reprocess
   * files when they change on disk. */
  watch?: boolean;
  /**
   * Register a callback to run when diagnostics are emitted.
   * If not provided, a callback can be registered after
   * initialization, but will not receive any diagnostics
   * from the initial parse.
   */
  onDiagnostics?: OnDiagnostics;
  /**
   * If registered, this callback will be used to report
   * when progress has been made towards loading the project.
   */
  onLoadProgress?: (increment: number, message?: string) => void;
  settings?: {
    /**
     * Symbols starting with these prefixes that are not declared
     * in the coded will be treated as global symbols.
     */
    autoDeclareGlobalsPrefixes?: string[];
  };
}

export class Project {
  yyp!: Yyp;
  /** Until this resolves, assume that this.yyp is not yet read */
  yypWaiter?: Promise<any>;

  config!: StitchConfig;

  readonly assets = new Map<AssetName, Asset>();
  /**
   * Store the "native" functions, constants, and enums on
   * a per-project basis, but separately from the project-specific
   * symbols. The native symbols and types are loaded from the spec,
   * so they can vary between projects. */
  native!: Native;
  helpLinks!: { [method: string]: string };
  /**
   * When resolved, the GML spec has been loaded and the
   * `native` property has been populated.
   */
  nativeWaiter?: Promise<void>;
  /**
   * The type of the 'global' struct, which contains all globalvars
   * and globally defined functions. */
  self!: StructType;
  /**
   * The `global` symbol, which has type `self`. */
  symbol!: Signifier;
  /**
   * Non-native global types, which can be referenced in JSDocs
   * and in a symbol's types. */
  readonly types = new Map<string, Type>();

  protected emitter = new EventEmitter();
  /** Code that needs to be reprocessed, for one reason or another. */
  protected dirtyFiles = new Set<Code>();

  protected constructor(
    readonly yypPath: Pathy,
    readonly options?: ProjectOptions,
  ) {}

  queueDirtyFileUpdate(code: Code): void {
    this.dirtyFiles.add(code);
  }

  drainDirtyFileUpdateQueue() {
    for (const code of this.dirtyFiles) {
      code.updateDiagnostics();
      // await code.reload(code.content);
    }
    this.dirtyFiles.clear();
  }

  async setIdeVersion(version: string) {
    assert(version.match(/^\d+\.\d+\.\d+\.\d+$/), 'Invalid version string');
    this.yyp.MetaData.IDEVersion = version;
    await this.saveYyp();
  }

  get ideVersion(): string {
    return this.yyp.MetaData.IDEVersion;
  }

  get dir(): Pathy {
    return pathy(this.yypPath).up();
  }

  get stitchConfig() {
    return this.dir
      .join(stitchConfigFilename)
      .withValidator(stitchConfigSchema);
  }

  get configs(): string[] {
    const configs: string[] = [];
    let configTree: YypConfig[] = [this.yyp.configs];
    while (configTree.length) {
      const nextTree: YypConfig[] = [];
      for (const config of configTree) {
        configs.push(config.name);
        nextTree.push(...(config.children || []));
      }
      configTree = nextTree;
    }
    return configs;
  }

  get datafiles() {
    return this.yyp.IncludedFiles;
  }

  get folders() {
    return this.yyp.Folders.map((f) => groupPathToPosix(f.folderPath));
  }

  /**
   * Run a callback when diagnostics are emitted. Returns an unsubscribe function. */
  onDiagnostics(callback: OnDiagnostics): () => void {
    this.emitter.on('diagnostics', callback);
    return () => this.emitter.off('diagnostics', callback);
  }

  emitDiagnostics(code: Code | string, diagnostics: Diagnostic[]): void {
    // Ensure they are valid diagnostics
    for (const diagnostic of diagnostics) {
      ok(diagnostic.$tag === 'diagnostic');
      ok(diagnostic.location);
    }
    this.emitter.emit('diagnostics', {
      code: code instanceof Code ? code : undefined,
      filePath: code instanceof Code ? code.path.absolute : code,
      diagnostics,
    });
  }

  getAssetByName<Assert extends boolean>(
    name: string | undefined,
    options?: { assertExists: Assert },
  ): Assert extends true ? Asset : Asset | undefined {
    assert(name || !options?.assertExists, 'No asset name provided');
    if (!name) {
      return undefined as Assert extends true ? Asset : Asset | undefined;
    }
    const asset = this.assets.get(name.toLocaleLowerCase());
    assert(asset || !options?.assertExists, `Asset "${name}" does not exist.`);
    return asset as Assert extends true ? Asset : Asset | undefined;
  }

  @sequential
  async removeAssetByName(name: string | undefined) {
    if (!name) return;
    name = name.toLocaleLowerCase();
    const asset = this.assets.get(name);
    if (!asset) return;
    this.assets.delete(name);
    // Remove the asset from the yyp
    const resourceIdx = this.yyp.resources.findIndex(
      (r) => r.id.name.toLocaleLowerCase() === name,
    );
    // If it's a room, remove it from the room order list
    if (isAssetOfKind(asset, 'rooms')) {
      this.yyp.RoomOrderNodes = this.yyp.RoomOrderNodes.filter((node) => {
        node.roomId.path.toLowerCase() !== asset.resource.id.path.toLowerCase();
      });
    }
    if (resourceIdx > -1) {
      this.yyp.resources.splice(resourceIdx, 1);
      await this.saveYyp();
    }

    // Clean up
    await asset.onRemove();
  }

  getAsset(path: Pathy<any>): Asset | undefined {
    return this.assets.get(this.assetNameFromPath(path));
  }

  getGmlFile(path: Pathy<any>): Code | undefined {
    const resource = this.getAsset(path);
    if (!resource) {
      return;
    }
    return resource.getGmlFile(path);
  }

  parseIncludedFilePath(
    filePath: string,
    name?: string,
  ): { filePath: string; name: string } {
    filePath.replace(/[/\\]+$/, '/').replace(/\/$/, '');
    if (!name) {
      ({ folder: filePath, name } =
        filePath.match(/^(?<folder>.*)[/\\](?<name>[^/\\]+)$/)?.groups || {});
    }
    assert(filePath, `Invalid folder: ${filePath}`);
    assert(name, `Invalid name: ${name}`);
    assert(
      filePath === 'datafiles' || filePath.startsWith('datafiles/'),
      `Folder must be in datafiles: ${filePath}`,
    );
    return { filePath, name };
  }

  findIncludedFile(filePath: string, name?: string) {
    ({ filePath, name } = this.parseIncludedFilePath(filePath, name));
    return this.datafiles.find(
      (f) =>
        f.name.toLowerCase() === name!.toLowerCase() &&
        f.filePath.toLowerCase() === filePath.toLowerCase(),
    );
  }

  /**
   * Ensure that the included files listed in the YYP exactly match
   * the files in the `datafiles` directory.
   */
  @sequential
  async syncIncludedFiles() {
    const includedFiles = (
      await this.dir.join('datafiles').listChildrenRecursively()
    ).map((f) => {
      /** The filepath relative to the project dir (starts with 'datafiles') */
      const fullPath = f.relativeFrom(this.dir);
      // Will throw with unexpected paths, preventing anything from being
      // overwritten. This is a better outcome than skipping those files.
      const { filePath, name } = this.parseIncludedFilePath(fullPath);
      const existing = this.findIncludedFile(filePath, name);

      return existing || { filePath, name };
    });
    // Note: Should check if there have been any changes, and only write if not!
    // No need to compare with what's already in there, just overwrite it!
    // GameMaker seems to sort these by full path, so we'll do the same to
    // prevent git noise.
    // @ts-expect-error The schema will ensure it's written correctly
    this.yyp.IncludedFiles = includedFiles;
    await this.saveYyp();
  }

  registerAsset(resource: Asset): void {
    const name = this.assetNameFromPath(resource.dir);
    ok(!this.assets.has(name), `Resource ${name} already exists`);
    this.assets.set(name, resource);
  }

  @sequential
  async renameAsset(from: string, to: string) {
    const asset = this.getAssetByName(from, { assertExists: true });
    assertIsValidIdentifier(to);
    const toAsset = this.getAssetByName(to);
    assert(!toAsset, `Cannot rename. An asset named "${to}" already exists`);

    // Create a new asset with the new name, copying over the old asset's files and updating them as needed
    const newAssetDir = asset.dir.up().join(to);
    const reset = async () =>
      await newAssetDir.delete({ force: true, recursive: true });
    await newAssetDir.ensureDirectory();
    await newAssetDir.isEmptyDirectory({ assert: true });
    await asset.dir.copy(newAssetDir);

    // The yy files contain the old 'name' field, and there may be
    // other files named after the old asset name.
    // Rename all copied files that have the old asset name in them
    const oldNamePattern = new RegExp(`\\b${from}\\b`, 'gi');
    let newYyFile: Pathy | undefined;
    await newAssetDir.listChildrenRecursively({
      filter: async (p) => {
        if (await p.isDirectory()) return;
        // Get the relative path
        const relative = p.relativeFrom(newAssetDir);
        const newRelative = relative.replaceAll(oldNamePattern, to);
        if (newRelative === relative) return;
        // Rename!
        const newFile = newAssetDir.join(newRelative);
        if (newRelative === `${to}.yy`) {
          newYyFile = newFile;
        }
        await p.copy(newFile);
        await p.delete();
      },
    });
    if (!newYyFile) {
      await reset();
      throwError(`Could not find yy after copying files`);
    }
    // Update the "name" field
    const yy = await Yy.read(newYyFile.absolute, asset.assetKind);
    yy.name = to;
    if (isAssetOfKind(asset, 'sounds')) {
      // Then we've renamed the sound file and need to update that in the yy!
      const yySound = yy as YySound;
      yySound.soundFile = yySound.soundFile.replace(oldNamePattern, to);
    }
    await Yy.write(newYyFile.absolute, yy, asset.assetKind, this.yyp);

    // Register the new asset
    const info = await this.addAssetToYyp(newYyFile!.absolute);
    const newAsset = await Asset.from(this, info);
    assert(newAsset, `Could not create new asset ${to}`);
    this.registerAsset(newAsset);

    // Remove the old asset
    await this.removeAssetByName(from);

    // Fully process the change
    await this.initiallyParseAssetCode([newAsset]);

    // Update the code from all refs to have the new name
    await this.renameSignifier(asset.signifier, to);

    if (isAssetOfKind(newAsset, 'objects')) {
      // Update immediate children to have the new asset as the parent
      for (const child of asset.children) {
        child.parent = newAsset;
      }
      // Update any rooms that reference the old object name
      for (const room of this.assets.values()) {
        if (!isAssetOfKind(room, 'rooms')) continue;
        await room.renameRoomInstanceObjects(from, to);
      }
    }
  }

  async renameSignifier(signifier: Signifier, newName: string) {
    assertIsValidIdentifier(newName);
    // Rename the signifier
    const files = new Set<Code>();
    signifier.refs.forEach((ref) => files.add(ref.start.file));
    const waits: Promise<any>[] = [];
    for (const file of files) {
      waits.push(file.renameSignifier(signifier, newName));
    }
    await Promise.all(waits);
  }

  @sequential
  async import(
    fromProject: Project | string,
    options: ImportModuleOptions = {},
  ) {
    if (typeof fromProject === 'string') {
      fromProject = await Project.initialize(fromProject);
    }
    return await importAssets(fromProject, this, options);
  }

  @sequential
  async duplicateAsset(sourceName: string, newPath: string) {
    const source = this.getAssetByName(sourceName, { assertExists: true });
    const parsed = await this.parseNewAssetPath(newPath);
    assert(parsed, `Invalid new asset path: ${newPath}`);
    // Copy all files in the source's directory to a new directory named
    // after the new name.
    const kind = source.assetKind;
    const cloneDir = this.dir.join(`${kind}/${parsed.name}`);
    await cloneDir.ensureDirectory();
    await source.dir.copy(cloneDir);
    // Rename any files named after the original asset
    const oldNamePattern = new RegExp(`\\b${sourceName}\\b`, 'gi');
    let yyFile: Pathy<YySchema<any>> | undefined;
    await cloneDir.listChildrenRecursively({
      filter: async (p) => {
        if (await p.isDirectory()) return;
        // Get the relative path
        const relative = p.relativeFrom(cloneDir);
        const newRelative = relative.replaceAll(oldNamePattern, parsed.name);
        if (newRelative === relative) return;
        // Rename!
        const newFile = cloneDir.join(newRelative);
        await p.copy(newFile);
        await p.delete();
        if (
          newFile.hasExtension('yy') &&
          newFile.name.toLowerCase() === parsed.name.toLowerCase()
        ) {
          yyFile = newFile;
        }
      },
    });
    assert(yyFile, `Could not find yy file for new asset ${parsed.name}`);
    // Update the yy files to replace the old name with the new
    // Just read them as text so we don't have to deal with parsing
    const content: string = await yyFile.read({ encoding: 'utf8' });
    const newContent = content.replaceAll(
      new RegExp(`"${sourceName}"`, 'gi'),
      `"${parsed.name}"`,
    );
    await yyFile.write(newContent);
    // Add the new asset to the yyp file
    const info = await this.addAssetToYyp(yyFile.absolute);
    const newAsset = await Asset.from(this, info);
    assert(newAsset, `Could not create new asset ${parsed.name}`);
    this.registerAsset(newAsset);
    return newAsset;
  }

  @sequential
  async createSound(path: string, fromFile: string | Pathy) {
    // Create the yy file
    const parsed = await this.parseNewAssetPath(path);
    if (!parsed) {
      return;
    }
    const { name, folder } = parsed;
    assert(
      isValidSoundName(name, this.config),
      `Sound name '${name}' does not match allowed patterns`,
    );

    const defaults = getDefaultsForNewSound(name, this.config);
    const soundDir = this.dir.join(`sounds/${name}`);
    await soundDir.ensureDirectory();
    const soundYy = soundDir.join(`${name}.yy`);
    // Copy the sound file over
    fromFile = pathy(fromFile);
    const soundFileName = `${name}${fromFile.extname}`;
    await fromFile.copy(soundDir.join(soundFileName));

    await Yy.write(
      soundYy.absolute,
      {
        name,
        parent: {
          name: folder.name,
          path: folder.folderPath,
        },
        type: defaults?.mono ? SoundChannel.Mono : SoundChannel.Stereo,
        soundFile: soundFileName,
        duration: 0,
      },
      'sounds',
      this.yyp,
    );

    // Update the yyp file
    const info = await this.addAssetToYyp(soundYy.absolute);

    // Create and add the asset
    const asset = await Asset.from(this, info);
    if (asset) {
      this.registerAsset(asset);
    }
    return asset;
  }

  @sequential
  async createRoom(path: string): Promise<Asset<'rooms'> | undefined> {
    const parsed = await this.parseNewAssetPath(path);
    if (!parsed) {
      return;
    }
    const { name, folder } = parsed;

    const roomDir = this.dir.join(`rooms/${name}`);
    await roomDir.ensureDirectory();
    const roomYy = roomDir.join(`${name}.yy`);

    const yy = yyRoomSchema.parse({
      name,
      parent: {
        name: folder.name,
        path: folder.folderPath,
      },
      layers: [{ resourceType: 'GMRBackgroundLayer' }],
      views: [...Array(8)].map(() => ({})),
    });
    yy.views[0].visible = true;

    await Yy.write(roomYy.absolute, yy, 'rooms', this.yyp);

    // Update the yyp file
    const info = await this.addAssetToYyp(roomYy.absolute, { skipSave: true });
    this.yyp.RoomOrderNodes.push({ roomId: info.id });
    await this.saveYyp();

    // Create and add the asset
    const asset = await Asset.from(this, info);
    if (asset) {
      this.registerAsset(asset);
    }
    return asset as Asset<'rooms'>;
  }

  @sequential
  async createSprite(
    path: string,
    fromImageFile: string | Pathy,
  ): Promise<Asset<'sprites'> | undefined> {
    // Create the yy file
    const parsed = await this.parseNewAssetPath(path);
    if (!parsed) {
      return;
    }
    const { name, folder } = parsed;
    assert(
      isValidSpriteName(name, this.config),
      `Sprite name '${name}' does not match allowed patterns`,
    );

    const spriteDir = this.dir.join(`sprites/${name}`);
    await spriteDir.ensureDirectory();
    const spriteYy = spriteDir.join(`${name}.yy`);

    // Get the source image dimensions
    fromImageFile = pathy(fromImageFile);
    assert(fromImageFile.hasExtension('png'), `Expected a .png file`);
    const { width, height } = await getPngSize(fromImageFile);
    const xorigin = Math.floor(width / 2) - 1;
    const yorigin = Math.floor(height / 2) - 1;
    const frames: any[] = [];
    frames.length = 1;
    const yy = yySpriteSchema.parse({
      name,
      parent: {
        name: folder.name,
        path: folder.folderPath,
      },
      type: SpriteType.Default,
      width,
      height,
      sequence: { xorigin, yorigin },
      frames,
    });
    // Now we'll have a frameId
    const frameId = yy.frames[0].name;
    assert(frameId, `Expected a frameId`);
    await fromImageFile.copy(spriteDir.join(`${frameId}.png`));

    await Yy.write(spriteYy.absolute, yy, 'sprites', this.yyp);

    // Update the yyp file
    const info = await this.addAssetToYyp(spriteYy.absolute);

    // Create and add the asset
    const asset = await Asset.from(this, info);
    if (asset) {
      this.registerAsset(asset);
    }
    return asset as Asset<'sprites'>;
  }

  /**
   * Add an object to the yyp file. The string can include separators,
   * in which case folders will be ensured up to the final component.
   */
  @sequential
  async createObject(path: string): Promise<Asset<'objects'> | undefined> {
    // Create the yy file
    const parsed = await this.parseNewAssetPath(path);
    if (!parsed) {
      return;
    }
    const { name, folder } = parsed;
    const objectDir = this.dir.join(`objects/${name}`);
    await objectDir.ensureDirectory();
    const objectYy = objectDir.join(`${name}.yy`);
    const objectCreateFile = objectDir.join('Create_0.gml');
    await objectCreateFile.write('/// ');

    await Yy.write(
      objectYy.absolute,
      {
        name,
        parent: {
          name: folder.name,
          path: folder.folderPath,
        },
        // Include the Create event by default
        eventList: [{ eventNum: 0, eventType: 0 }],
      },
      'objects',
      this.yyp,
    );

    // Update the yyp file
    const info = await this.addAssetToYyp(objectYy.absolute);

    // Create and add the asset
    const asset = await Asset.from(this, info);
    if (asset) {
      this.registerAsset(asset);
    }
    return asset as Asset<'objects'>;
  }

  @sequential
  async createShader(path: string): Promise<Asset<'shaders'> | undefined> {
    // Create the yy file
    const parsed = await this.parseNewAssetPath(path);
    if (!parsed) {
      return;
    }
    const { name, folder } = parsed;
    const shaderDir = this.dir.join(`shaders/${name}`);
    await shaderDir.ensureDirectory();
    const shaderYy = shaderDir.join(`${name}.yy`);
    await Yy.write(
      shaderYy.absolute,
      {
        name,
        parent: {
          name: folder.name,
          path: folder.folderPath,
        },
      },
      'shaders',
      this.yyp,
    );

    // Create the fsh and vsh files
    const fsh = shaderYy.changeExtension('fsh');
    await fsh.write(fshDefault);
    const vsh = shaderYy.changeExtension('vsh');
    await vsh.write(vshDefault);

    // Update the yyp file
    const info = await this.addAssetToYyp(shaderYy.absolute);

    // Create and add the asset
    const asset = await Asset.from(this, info);
    if (asset) {
      this.registerAsset(asset);
    }
    return asset as Asset<'shaders'>;
  }

  /**
   * Add a script to the yyp file. The string can include separators,
   * in which case folders will be ensured up to the final component.
   */
  @sequential
  async createScript(path: string): Promise<Asset<'scripts'> | undefined> {
    // Create the yy file
    const parsed = await this.parseNewAssetPath(path);
    if (!parsed) {
      return;
    }
    const { name, folder } = parsed;
    assertIsValidIdentifier(name);
    const scriptDir = this.dir.join(`scripts/${name}`);
    await scriptDir.ensureDirectory();
    const scriptYy = scriptDir.join(`${name}.yy`);
    await Yy.write(
      scriptYy.absolute,
      {
        name,
        parent: {
          name: folder.name,
          path: folder.folderPath,
        },
      },
      'scripts',
      this.yyp,
    );

    // Create the gml file
    const scriptGml = scriptYy.changeExtension('gml');
    await scriptGml.write('/// ');

    // Update the yyp file
    const info = await this.addAssetToYyp(scriptYy.absolute);

    // Create and add the asset
    const asset = await Asset.from(this, info);
    if (asset) {
      this.registerAsset(asset);
    }
    return asset as Asset<'scripts'>;
  }

  protected async parseNewAssetPath(path: string) {
    const parts = path.split(/[/\\]+/);
    const name = parts.pop()!;
    if (!name) {
      logger.error(`Attempted to add script with no name: ${path}`);
      return;
    }
    assertIsValidIdentifier(name);
    const existingAsset = this.getAssetByName(name);
    if (existingAsset) {
      logger.error(
        `An asset named ${path} (${existingAsset.assetKind}) already exists`,
      );
      return;
    }
    if (!parts.length) {
      logger.error(`Adding scripts to the root directory is not supported.`);
      return;
    }
    const folder = (await this.createFolder(parts))!;
    return { folder, name };
  }

  /**
   * Given the path to a yy file for an asset, ensure
   * it has an entry in the yyp file. */
  async addAssetToYyp(
    yyPath: string,
    options?: { skipSave?: boolean },
  ): Promise<YypResource> {
    assert(yyPath.endsWith('.yy'), `Expected yy file, got ${yyPath}`);
    const parts = yyPath.split(/[/\\]+/).slice(-3);
    assert(
      parts.length === 3,
      `Expected path with at least 3 parts, got ${yyPath}`,
    );
    const [type, name, basename] = parts;
    const resourceEntry: YypResource = {
      id: {
        name,
        path: `${type}/${name}/${basename}`,
      },
    };
    // Insert the resource into a random spot in the list to avoid git conflicts,
    // avoiding the last spot because that's where changes are most likely to be.
    // (This only matters for older project versions -- the newer version )
    const lastAllowed = Math.max(0, this.yyp.resources.length - 1);
    const insertAt = Math.floor(Math.random() * lastAllowed);
    this.yyp.resources.splice(insertAt, 0, resourceEntry);
    if (!options?.skipSave) {
      await this.saveYyp();
    }
    return resourceEntry;
  }

  protected parseFolderPath(path: string | string[]) {
    const parts = Array.isArray(path) ? path : path.split(/[/\\]+/);
    const full = `folders/${parts.join('/')}.yy`;
    const prefix = `folders/${parts.join('/')}/`;
    return { parts, full, prefix };
  }

  listAssetsInFolder(
    path: string | string[],
    options?: { recursive: boolean },
  ) {
    const { full, prefix } = this.parseFolderPath(path);
    const foundAssets: Asset[] = [];

    for (const asset of this.assets.values()) {
      const assetFolder = asset.yy?.parent as yyParentSchema;
      if (assetFolder.path === full) {
        foundAssets.push(asset);
      } else if (options?.recursive && assetFolder.path.startsWith(prefix)) {
        foundAssets.push(asset);
      }
    }
    return foundAssets;
  }

  /**
   * Delete a folder recursively. Only allowed if there are no assets
   * in this or any subfolder.
   */
  @sequential
  async deleteFolder(path: string | string[]) {
    const assets = this.listAssetsInFolder(path, { recursive: true });
    const { full, prefix } = this.parseFolderPath(path);
    assert(!assets.length, 'Cannot delete folder containing assets!');
    for (let f = this.yyp.Folders.length - 1; f >= 0; f--) {
      const currentFolder = this.yyp.Folders[f];
      // If this is the "old" folder, delete it
      if (
        full === currentFolder.folderPath ||
        currentFolder.folderPath.startsWith(prefix)
      ) {
        this.yyp.Folders.splice(f, 1);
        continue;
      }
    }
    await this.saveYyp();
  }

  /**
   * Rename an existing folder. Allows for renaming any part of
   * the path (useful both "moving" and "renaming" a folder).
   * Array inputs are interpreted as pre-split paths. If the new
   * name matches an existing folder, it will in effect be "merged"
   * with that existing folder.
   *
   * Returns the list of folders and assets that are now in a new
   * location. */
  @sequential
  async renameFolder(oldPath: string | string[], newPath: string | string[]) {
    const oldParts = Array.isArray(oldPath) ? oldPath : oldPath.split(/[/\\]+/);
    const newParts = Array.isArray(newPath) ? newPath : newPath.split(/[/\\]+/);
    if (!oldParts.length) {
      logger.warn(`Cannot rename root folder`);
      return;
    }
    if (oldParts.join('/') === newParts.join('/')) {
      logger.warn(`Folder is already named that. Skipping rename.`);
      return;
    }
    // Ensure the new folder exists
    const targetFolder = await this.createFolder(newParts);
    if (!targetFolder) return;

    // Move subfolders from the old folder to the new folder
    const oldPathFull = `folders/${oldParts.join('/')}.yy`;
    const oldPathPrefix = `folders/${oldParts.join('/')}/`;
    const newPathPrefix = `folders/${newParts.join('/')}/`;
    const movedFolders: [from: YypFolder, to: YypFolder | undefined][] = [];
    // Start from the end so we can delete as we go
    for (let f = this.yyp.Folders.length - 1; f >= 0; f--) {
      const currentFolder = this.yyp.Folders[f];
      // If this is the "old" folder, delete it
      if (oldPathFull === currentFolder.folderPath) {
        this.yyp.Folders.splice(f, 1);
        movedFolders.push([currentFolder, undefined]);
        continue;
      }
      // If this is a subfolder of the old folder, move it
      if (currentFolder.folderPath.startsWith(oldPathPrefix)) {
        const newPath = currentFolder.folderPath.replace(
          oldPathPrefix,
          newPathPrefix,
        );
        this.yyp.Folders[f] = {
          ...currentFolder,
          folderPath: newPath,
        };
        movedFolders.push([currentFolder, this.yyp.Folders[f]]);
      }
    }
    await this.saveYyp();

    // Move assets from the old folder to the new folder
    const movedAssets: Asset[] = [];
    for (const asset of this.assets.values()) {
      const assetFolder = asset.yy?.parent as yyParentSchema;
      let moved = false;
      if (assetFolder.path === oldPathFull) {
        asset.yy.parent = {
          name: targetFolder.name,
          path: targetFolder.folderPath,
        };
        moved = true;
      } else if (assetFolder.path.startsWith(oldPathPrefix)) {
        // The name comes from a subfolder, so just need to update the path
        asset.yy.parent = {
          name: assetFolder.name,
          path: assetFolder.path.replace(oldPathPrefix, newPathPrefix),
        };
        moved = true;
      }
      if (moved) {
        movedAssets.push(asset);
        await asset.saveYy();
      }
    }
    return { movedFolders, movedAssets };
  }

  /**
   * Add a folder to the yyp file. The string can include separators,
   * in which case nested folders will be created. If an array is provided,
   * it is interpreted as a pre-split path. */
  async createFolder(
    path: string | string[],
    options?: { skipSave?: boolean },
  ): Promise<YypFolder | undefined> {
    const parts = Array.isArray(path) ? path : path.split(/[/\\]+/);
    const folders = this.yyp.Folders;
    let current = 'folders/';
    let folder: YypFolder | undefined;
    /** A random location in the list where this new folder should be put,
     * to reduce git conflicts.*/
    const insertAt = Math.max(
      Math.floor(Math.random() * folders.length - 1),
      0,
    );
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      if (!part) {
        continue;
      }
      const thisFolderPath = current + part + '.yy';
      folder = folders.find((f) => f.folderPath === thisFolderPath);
      if (!folder) {
        folder = yypFolderSchema.parse({
          folderPath: thisFolderPath,
          name: part,
        });
        folders.splice(insertAt, 0, folder);
      }
      current += part + '/';
    }
    if (!options?.skipSave) {
      await this.saveYyp();
    }
    return folder;
  }

  @sequential
  async saveYyp() {
    await Yy.write(this.yypPath.absolute, this.yyp, 'project');
  }

  /**
   * The name of a resource, *in lower case*, from
   * a path. This is used as the key for looking up resources.
   *
   * The path can be to the asset's folder, or to any file within
   * that folder.
   */
  assetNameFromPath(path: Pathy<any>): string {
    const parts = path.relativeFrom(this.dir).split(/[/\\]+/);
    return parts[1]?.toLocaleLowerCase?.();
  }

  /**
   * When first creating an instance, we need to get all project file
   * content into memory for fast access. In particular, we need all
   * yyp, yy, and gml files for scripts and objects. For other asset types
   * we just need their names and yyp filepaths.
   *
   * Can be called at any time -- will only operate on new assets.
   *
   * Returns the list of added assets. Assets are instanced and registered but their
   * code is not parsed!
   */
  protected async loadAssets(options?: ProjectOptions): Promise<Asset[]> {
    const t = Date.now();

    // Load AudioGroup assets
    for (const audioGroup of this.yyp.AudioGroups) {
      if (!this.self.getMember(audioGroup.name)) {
        const signifier = new Signifier(
          this.self,
          audioGroup.name,
          new Type('Asset.GMAudioGroup'),
        );
        signifier.global = true;
        signifier.writable = false;
        this.self.addMember(signifier);
      }
    }

    // We'll say that resources take 80% of loading,
    // and distribute that across the number of resources.
    const perAssetIncrement = this.yyp.resources.length / 80;
    const resourceWaits: Promise<Asset | undefined>[] = [];
    for (const resourceInfo of this.yyp.resources) {
      assert(
        resourceInfo.id.name,
        `Resource ${resourceInfo.id.path} has no name`,
      );
      const name = resourceInfo.id.name.toLocaleLowerCase();
      // Skip it if we already have it
      if (this.assets.has(name)) {
        continue;
      }

      resourceWaits.push(
        Asset.from(this, resourceInfo).then((r) => {
          if (!r) {
            logger.warn(`Resource ${resourceInfo.id.name} has no yy file`);
            return;
          }
          this.registerAsset(r);
          options?.onLoadProgress?.(perAssetIncrement, `Loading assets...`);
          return r;
        }),
      );
    }
    const addedAssets = await Promise.all(resourceWaits);
    options?.onLoadProgress?.(1, `Loaded ${this.assets.size} resources`);
    logger.log(`Loaded ${this.assets.size} resources in ${Date.now() - t}ms`);
    return addedAssets.filter((x) => x) as Asset[];
  }

  protected async loadHelpLinks(): Promise<void> {
    // Need the path to the IDE folder. Can probably get by with the default
    // installation location...
    await this.nativeWaiter;
    const file = await Native.findHelpLinksFile(this.ideVersion);
    const content = await file?.read({ fallback: {} });
    this.helpLinks = new Proxy(content || ({} as { [key: string]: string }), {
      get: (target, key) => {
        const baseUrl = `https://beta-manual.yoyogames.com/#t=`;
        if (typeof key === 'string' && key in target) {
          return `${baseUrl}${encodeURIComponent(target[key])}.htm`;
        } else if (typeof key === 'string') {
          return `${baseUrl}Content.htm&rhsearch=${encodeURIComponent(
            key,
          )}&ux=${encodeURIComponent(key)}`;
        }
        return `${baseUrl}Content.htm`;
      },
    });
  }

  @sequential
  async reloadConfig() {
    this.config = await this.stitchConfig.read({ fallback: {} });
    return this.config;
  }

  @sequential
  async getWindowsName(): Promise<string | undefined> {
    const windowOptionsFile = this.dir.join(
      'options/windows/options_windows.yy',
    );
    if (!(await windowOptionsFile.exists())) {
      return;
    }
    const content = (await Yy.read(windowOptionsFile.absolute)) as {
      option_windows_display_name?: string;
    };
    return content.option_windows_display_name;
  }

  /**
   * Load the GML spec for the project's runtime version, falling
   * back on the included spec if necessary.
   */
  protected async loadGmlSpec(): Promise<void> {
    const t = Date.now();

    this.self = new Type('Struct').named('global') as StructType;
    this.symbol = new Signifier(this.self, 'global', this.self);
    this.symbol.global = true;
    this.symbol.writable = false;
    this.symbol.def = {};

    let runtimeVersion: string | undefined;
    // Check for a stitch config file that specifies the runtime version.
    // If it exists, use that version. It's likely that it is correct, and this
    // way we don't have to download the releases summary.
    if (this.config.runtimeVersion) {
      logger.info('Found stitch config');
      runtimeVersion = this.config.runtimeVersion;
    }
    await this.yypWaiter; // To ensure that `this.ideVersion` exists
    const specFiles = await Native.listSpecFiles({
      ideVersion: this.ideVersion,
      runtimeVersion,
    });
    this.native = await Native.from(specFiles, this.self, this.types);
    logger.log(`Loaded GML spec in ${Date.now() - t}ms`);
  }

  /**
   * Call to reload the project's yyp file (e.g. because it has changed
   * on disk) and add/remove any resources.
   */
  async reloadYyp() {
    // Update the YYP and identify new/deleted assets
    // const oldYyp = this.yyp;
    assert(this.yypPath, 'Cannot reload YYP without a path');
    this.yyp = await Yy.read(this.yypPath.absolute, 'project');

    // // NOTE: This is disabled because it's doesn't behave well
    // // Remove old assets
    // const assetIds = new Map(
    //   this.yyp.resources.map((r) => [r.id.path, r.id]),
    // );
    // const removedAssets = oldYyp.resources.filter(
    //   (r) => !assetIds.has(r.id.path),
    // );
    // for (const removedAsset of removedAssets) {
    //   await this.removeAssetByName(removedAsset.id.name);
    // }

    // Add new assets
    const newAssets = await this.loadAssets();
    await this.initiallyParseAssetCode(newAssets);

    // Try to keep anything that got touched *clean*
    this.drainDirtyFileUpdateQueue();
  }

  /** Initialize a collection of new assets by parsing their GML */
  initiallyParseAssetCode(assets: Asset[]) {
    // Do scripts before objects
    assets = [...assets.values()].sort((a, b) => {
      if (a.assetKind === b.assetKind) {
        return a.name.localeCompare(b.name);
      }
      if (a.assetKind === 'scripts') {
        return -1;
      }
      if (b.assetKind === 'scripts') {
        return 1;
      }
      if (a.assetKind === 'objects') {
        return -1;
      }
      if (b.assetKind === 'objects') {
        return 1;
      }
      return a.name.localeCompare(b.name);
    });

    logger.info('Discovering globals...');
    for (const asset of assets) {
      asset.updateGlobals(true);
    }
    // Discover all symbols and their references
    logger.info('Discovering symbols...');
    for (const asset of assets) {
      asset.updateAllSymbols(true);
    }
    // Second pass
    // TODO: Find a better way than brute-forcing to resolve cross-file references
    for (const pass of [1]) {
      logger.info(`Re-processing pass ${pass}...`);
      // const reloads: Promise<any>[] = [];
      for (const asset of assets) {
        asset.updateGlobals();
        asset.updateAllSymbols();
        //   for (const file of asset.gmlFilesArray) {
        //     reloads.push(file.reload(file.content));
        //   }
      }
      // await Promise.all(reloads);
    }

    // But for now, that's what we'll do!
    logger.info('Updating diagnostics...');
    for (const asset of assets) {
      asset.updateDiagnostics();
    }
  }

  async initialize(options?: ProjectOptions): Promise<void> {
    logger.info('Initializing project...');
    if (options?.onDiagnostics) {
      this.onDiagnostics(options.onDiagnostics);
    }
    let t = Date.now();
    await this.reloadConfig();
    assert(this.yypPath, 'Cannot initialize without a path');
    this.yypWaiter = Yy.read(this.yypPath.absolute, 'project').then((yyp) => {
      this.yyp = yyp;
      options?.onLoadProgress?.(5, 'Loaded project file');
      logger.info('Loaded yyp file!');
    });
    this.nativeWaiter = this.loadGmlSpec();
    void this.nativeWaiter.then(() => {
      options?.onLoadProgress?.(5, 'Loaded GML spec');
    });
    logger.info('Loading asset files...');
    await Promise.all([
      this.nativeWaiter,
      this.yypWaiter,
      this.loadHelpLinks(),
    ]);

    const assets = await this.loadAssets(options);
    logger.log(
      'Resources',
      this.assets.size,
      'loaded files in',
      Date.now() - t,
      'ms',
    );

    t = Date.now();
    // Discover all globals
    // Sort assets by type, with objects 2nd to last and scripts last
    // to minimize the number of things that need to be updated after
    // loading.
    options?.onLoadProgress?.(1, 'Parsing resource code...');

    await this.initiallyParseAssetCode(assets);
  }

  static async initialize(
    yypPath: string,
    options?: ProjectOptions,
  ): Promise<Project> {
    let path = pathy(yypPath);
    if (await path.isDirectory()) {
      const children = await path.listChildren();
      path = children.find((p) => p.hasExtension('yyp'))!;
      ok(path, 'No yyp file found in project directory');
    }
    await path.exists({ assert: true });
    const project = new Project(path, options);
    await project.initialize(options);
    return project;
  }

  static readonly fallbackGmlSpecPath = pathy(import.meta.url).resolveTo(
    '../../assets/GmlSpec.xml',
  );
}
