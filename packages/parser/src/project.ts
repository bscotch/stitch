import { pathy, Pathy } from '@bscotch/pathy';
import { GameMakerIde, GameMakerLauncher } from '@bscotch/stitch-launcher';
import { Yy, Yyp, YypFolder, yypFolderSchema, YypResource } from '@bscotch/yy';
import { EventEmitter } from 'events';
import { z } from 'zod';
import { logger } from './logger.js';
import { Asset } from './project.asset.js';
import { Code } from './project.code.js';
import { Diagnostic } from './project.diagnostics.js';
import { Native } from './project.native.js';
import { Signifier } from './signifiers.js';
import { StructType, Type } from './types.js';
import { PrimitiveName } from './types.primitives.js';
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
  protected dirtyCode = new Set<Code>();

  protected constructor(readonly yypPath: Pathy) {}

  addDirtyCode(code: Code): void {
    this.dirtyCode.add(code);
  }

  recheckDirtyCodeDiagnostics() {
    for (const code of this.dirtyCode) {
      code.updateDiagnostics();
    }
    this.dirtyCode.clear();
  }

  get ideVersion(): string {
    return this.yyp.MetaData.IDEVersion;
  }

  get projectDir(): Pathy {
    return pathy(this.yypPath).up();
  }

  createType<T extends PrimitiveName>(type: T): Type<T> {
    const baseType = this.types.get(type) as Type<T>;
    ok(baseType, `Unknown type '${type}'`);
    return baseType!.derive();
  }

  createStructType(subtype?: 'self' | 'instance'): StructType {
    const type = new Type('Struct');
    if (subtype) {
      const selfMember = type.addMember('self', type);
      selfMember.def = {};
      selfMember.writable = false;
      selfMember.instance = subtype === 'instance';
    }
    return type;
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

  getAssetByName(name: string): Asset | undefined {
    return this.assets.get(name.toLocaleLowerCase());
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

  protected addAsset(resource: Asset): void {
    const name = this.assetNameFromPath(resource.dir);
    ok(!this.assets.has(name), `Resource ${name} already exists`);
    this.assets.set(name, resource);
  }

  protected removeAsset(path: Pathy<any>): void {
    const name = this.assetNameFromPath(path);
    const resource = this.assets.get(name);
    ok(resource, `Resource ${name} does not exist`);
    resource.onRemove();
    this.assets.delete(name);
  }

  /**
   * Add a script to the yyp file. The string can include separators,
   * in which case folders will be ensured up to the final component.
   */
  async addScript(path: string) {
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
    const folder = (await this.addFolder(parts))!;

    // Create the yy file
    const scriptDir = this.projectDir.join(`scripts/${name}`);
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
    await scriptGml.write('/// @desc ');

    // Update the yyp file
    const info = await this.addAssetToYyp(scriptYy.absolute);

    // Create and add the asset
    const asset = await Asset.from(this, info, scriptYy);
    this.addAsset(asset);
    return asset;
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

  /**
   * Add a folder to the yyp file. The string can include separators,
   * in which case nested folders will be created. If an array is provided,
   * it is interpreted as a pre-split path. */
  async addFolder(path: string | string[]): Promise<YypFolder | undefined> {
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
    const parts = path.relativeFrom(this.projectDir).split(/[/\\]+/);
    return parts[1].toLocaleLowerCase();
  }

  /**
   * When first creating an instance, we need to get all project file
   * content into memory for fast access. In particular, we need all
   * yyp, yy, and gml files for scripts and objects. For other asset types
   * we just need their names and yyp filepaths.
   */
  protected async loadAssets(options?: ProjectOptions): Promise<void> {
    // TODO: Allow for reloading of resources, so that we only need to keep track of new/deleted resources.
    const t = Date.now();

    // Collect the asset dirs since we can run into capitalization issues.
    // We'll use these as a backup for "missing" resources.
    const assetNameToYy = new Map<string, Pathy>();
    const [yyp] = await Promise.all([
      Yy.read(this.yypPath.absolute, 'project'),
      this.projectDir.listChildrenRecursively({
        includeExtension: 'yy',
        maxDepth: 2,
        onInclude: (p) => {
          // Sometimes there is more than one yy file. Make sure that
          // we only keep the one matching the name.
          const dirname = p.up().name.toLocaleLowerCase();
          const assetName = p.name.toLocaleLowerCase();
          if (dirname !== assetName) {
            return;
          }
          assetNameToYy.set(this.assetNameFromPath(p), p);
        },
      }),
    ]);
    this.yyp = yyp;
    // We'll say that resources take 80% of loading,
    // and distribute that across the number of resources.
    const perAssetIncrement = this.yyp.resources.length / 80;
    const resourceWaits: Promise<any>[] = [];
    for (const resourceInfo of this.yyp.resources) {
      resourceWaits.push(
        Asset.from(
          this,
          resourceInfo,
          assetNameToYy.get(resourceInfo.id.name.toLocaleLowerCase())!,
        ).then((r) => {
          this.addAsset(r);
          options?.onLoadProgress?.(
            perAssetIncrement,
            `Loaded asset ${r.name}`,
          );
        }),
      );
    }
    await Promise.all(resourceWaits);
    options?.onLoadProgress?.(1, `Loaded ${this.assets.size} resources`);
    // TODO: Link up object parent-child relationships
    for (const asset of this.assets.values()) {
      if (asset.assetKind !== 'objects') {
        continue;
      }
      const obj = asset as Asset<'objects'>;
      if (!obj.yy.parentObjectId) {
        continue;
      }
      const parent = this.getAssetByName(obj.yy.parentObjectId.name);
      if (!parent) {
        // TODO: Add diagnostic if parent missing
        continue;
      }
      // Set the parent
      obj.parent = parent as Asset<'objects'>;
    }
    logger.log(`Loaded ${this.assets.size} resources in ${Date.now() - t}ms`);
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
    const stitchConfig = this.projectDir
      .join('stitch.config.json')
      .withValidator(
        z.object({ runtimeVersion: z.string().optional() }).passthrough(),
      );
    if (await stitchConfig.exists()) {
      logger.error('Found stitch config');
      const config = await stitchConfig.read();
      runtimeVersion = config.runtimeVersion;
    }
    if (!runtimeVersion) {
      logger.error('No stitch config found, looking up runtime version');
      // Look up the runtime version that matches the project's IDE version.
      await this.yypWaiter;
      const usingRelease = await GameMakerIde.findRelease({
        ideVersion: this.ideVersion,
      });
      // const releases = await fetchReleasesSummaryWithNotes();
      // const usingRelease = releases.find(
      //   (r) => r.ide.version === this.ideVersion,
      // );
      // Look up the GML Spec file that matches the project's runtime version.
      runtimeVersion = usingRelease?.runtime.version;
    }
    if (runtimeVersion) {
      // Find the locally installed runtime folder
      const installedRuntime = await GameMakerLauncher.findInstalledRuntime({
        version: runtimeVersion,
      });
      if (installedRuntime) {
        const gmlSpecPath = pathy(installedRuntime.directory).join(
          'GmlSpec.xml',
        );
        await gmlSpecPath.exists({ assert: true });
        this.native = await Native.from(
          gmlSpecPath.absolute,
          this.self,
          this.types,
        );
      }
    }
    // If we don't have a spec yet, use the fallback
    if (!this.native) {
      logger.error('No spec found, using fallback');
      this.native = await Native.from(undefined, this.self, this.types);
      ok(this.native, 'Failed to load fallback GML spec');
    }
    logger.log(`Loaded GML spec in ${Date.now() - t}ms`);
  }

  async initialize(options?: ProjectOptions): Promise<void> {
    logger.info('Initializing project...');
    if (options?.onDiagnostics) {
      this.onDiagnostics(options.onDiagnostics);
    }
    let t = Date.now();
    this.nativeWaiter = this.loadGmlSpec();
    this.yypWaiter = Yy.read(this.yypPath.absolute, 'project').then((yyp) => {
      this.yyp = yyp;
      options?.onLoadProgress?.(5, 'Loaded project file');
      logger.info('Loaded yyp file!');
    });
    void this.nativeWaiter.then(() => {
      options?.onLoadProgress?.(5, 'Loaded GML spec');
    });
    logger.info('Loading asset files...');
    const fileLoader = this.loadAssets(options);

    await Promise.all([this.nativeWaiter, fileLoader]);
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

    const assets = [...this.assets.values()].sort((a, b) => {
      if (a.assetKind === b.assetKind) {
        return a.name.localeCompare(b.name);
      }
      if (a.assetKind === 'scripts') {
        return 1;
      }
      if (b.assetKind === 'scripts') {
        return -1;
      }
      if (a.assetKind === 'objects') {
        return 1;
      }
      if (b.assetKind === 'objects') {
        return -1;
      }
      return a.name.localeCompare(b.name);
    });

    logger.info('Discovering globals...');
    for (const asset of assets) {
      asset.updateGlobals();
    }
    logger.log('Globals discovered in', Date.now() - t, 'ms');

    t = Date.now();
    // Discover all symbols and their references
    logger.info('Discovering symbols...');
    // Run through it twice to resolve cross-file references
    for (let i = 0; i < 2; i++) {
      for (const asset of assets) {
        asset.updateAllSymbols();
      }
    }
    // Second pass
    // TODO: Find a better way than brute-forcing to resolve cross-file references
    // But for now, that's what we'll do!
    logger.info('Updating diagnostics...');
    for (const asset of assets) {
      asset.updateDiagnostics();
      // for (const file of asset.gmlFilesArray) {
      //   await file.reload(file._content);
      // }
    }
    logger.info('Symbols discovered in', Date.now() - t, 'ms');
    // if (options?.watch) {
    //   this.watch();
    // }
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
