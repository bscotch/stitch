import { pathy, Pathy } from '@bscotch/pathy';
import {
  Yy,
  Yyp,
  yyParentSchema,
  YypFolder,
  yypFolderSchema,
  YypResource,
} from '@bscotch/yy';
import { EventEmitter } from 'events';
import { z } from 'zod';
import { logger } from './logger.js';
import { Asset } from './project.asset.js';
import { Code } from './project.code.js';
import { Diagnostic } from './project.diagnostics.js';
import { Native } from './project.native.js';
import { Signifier } from './signifiers.js';
import { StructType, Type } from './types.js';
import { assert, ok } from './util.js';
export { setLogger, type Logger } from './logger.js';

type AssetName = string;

export interface SymbolInfo {
  native: boolean;
  symbol: Signifier | Type;
}

export interface DiagnosticsEventPayload {
  code: Code;
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
}

export class Project {
  yyp!: Yyp;
  /** Until this resolves, assume that this.yyp is not yet read */
  yypWaiter?: Promise<any>;

  readonly assets = new Map<AssetName, Asset>();
  /**
   * Store the "native" functions, constants, and enums on
   * a per-project basis, but separately from the project-specific
   * symbols. The native symbols and types are loaded from the spec,
   * so they can vary between projects. */
  native!: Native;
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

  protected constructor(readonly yypPath: Pathy) {}

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

  /**
   * Run a callback when diagnostics are emitted. Returns an unsubscribe function. */
  onDiagnostics(callback: OnDiagnostics): () => void {
    this.emitter.on('diagnostics', callback);
    return () => this.emitter.off('diagnostics', callback);
  }

  emitDiagnostics(code: Code, diagnostics: Diagnostic[]): void {
    // Ensure they are valid diagnostics
    for (const diagnostic of diagnostics) {
      ok(diagnostic.$tag === 'diagnostic');
      ok(diagnostic.location);
      ok(diagnostic.location.file);
    }
    this.emitter.emit('diagnostics', { code, diagnostics });
  }

  getAssetByName(name: string | undefined): Asset | undefined {
    if (!name) {
      return;
    }
    return this.assets.get(name?.toLocaleLowerCase?.());
  }

  async removeAssetByName(name: string | undefined) {
    if (!name) return;
    name = name.toLocaleLowerCase();
    const asset = this.assets.get(name);
    if (!asset) return;
    this.assets.delete(name);
    // Remove the asset from the yyp
    const inYyp = this.yyp.resources.findIndex(
      (r) => r.id.name.toLocaleLowerCase() === name,
    );
    if (inYyp) {
      this.yyp.resources.splice(inYyp, 1);
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

  protected registerAsset(resource: Asset): void {
    const name = this.assetNameFromPath(resource.dir);
    ok(!this.assets.has(name), `Resource ${name} already exists`);
    this.assets.set(name, resource);
  }

  /**
   * Add an object to the yyp file. The string can include separators,
   * in which case folders will be ensured up to the final component.
   */
  async createObject(path: string) {
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
    );

    // Update the yyp file
    const info = await this.addAssetToYyp(objectYy.absolute);

    // Create and add the asset
    const asset = await Asset.from(this, info);
    if (asset) {
      this.registerAsset(asset);
    }
    return asset;
  }

  /**
   * Add a script to the yyp file. The string can include separators,
   * in which case folders will be ensured up to the final component.
   */
  async createScript(path: string) {
    // Create the yy file
    const parsed = await this.parseNewAssetPath(path);
    if (!parsed) {
      return;
    }
    const { name, folder } = parsed;
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
    return asset;
  }

  protected async parseNewAssetPath(path: string) {
    const parts = path.split(/[/\\]+/);
    const name = parts.pop()!;
    if (!name) {
      logger.error(`Attempted to add script with no name: ${path}`);
      return;
    }
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
  protected async addAssetToYyp(yyPath: string): Promise<YypResource> {
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
    this.yyp.resources.push(resourceEntry);
    await this.saveYyp();
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
  async createFolder(path: string | string[]): Promise<YypFolder | undefined> {
    const parts = Array.isArray(path) ? path : path.split(/[/\\]+/);
    const folders = this.yyp.Folders;
    let current = 'folders/';
    let folder: YypFolder | undefined;
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
        folders.push(folder);
      }
      current += part + '/';
    }
    await this.saveYyp();
    return folder;
  }

  protected async saveYyp() {
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
    const stitchConfig = this.dir
      .join('stitch.config.json')
      .withValidator(
        z.object({ runtimeVersion: z.string().optional() }).passthrough(),
      );
    if (await stitchConfig.exists()) {
      logger.info('Found stitch config');
      const config = await stitchConfig.read();
      runtimeVersion = config.runtimeVersion;
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
    const oldYyp = this.yyp;
    assert(this.yypPath, 'Cannot reload YYP without a path');
    this.yyp = await Yy.read(this.yypPath.absolute, 'project');
    const assetIds = new Map(this.yyp.resources.map((r) => [r.id.path, r.id]));

    // Remove old assets
    const removedAssets = oldYyp.resources.filter(
      (r) => !assetIds.has(r.id.path),
    );
    for (const removedAsset of removedAssets) {
      await this.removeAssetByName(removedAsset.id.name);
    }

    // Add new assets
    const newAssets = await this.loadAssets();
    await this.initiallyParseAssetCode(newAssets);

    // Try to keep anything that got touched *clean*
    this.drainDirtyFileUpdateQueue();
  }

  /** Initialize a collection of new assets by parsing their GML */
  protected async initiallyParseAssetCode(assets: Asset[]) {
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
    this.nativeWaiter = this.loadGmlSpec();
    assert(this.yypPath, 'Cannot initialize without a path');
    this.yypWaiter = Yy.read(this.yypPath.absolute, 'project').then((yyp) => {
      this.yyp = yyp;
      options?.onLoadProgress?.(5, 'Loaded project file');
      logger.info('Loaded yyp file!');
    });
    void this.nativeWaiter.then(() => {
      options?.onLoadProgress?.(5, 'Loaded GML spec');
    });
    logger.info('Loading asset files...');
    await Promise.all([this.nativeWaiter, this.yypWaiter]);

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
    const project = new Project(path);
    await project.initialize(options);
    return project;
  }

  static readonly fallbackGmlSpecPath = pathy(import.meta.url).resolveTo(
    '../../assets/GmlSpec.xml',
  );
}
