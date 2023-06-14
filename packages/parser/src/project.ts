import { pathy, Pathy } from '@bscotch/pathy';
import { GameMakerIde, GameMakerLauncher } from '@bscotch/stitch-launcher';
import { Yy, Yyp } from '@bscotch/yy';
import chokidar from 'chokidar';
import { EventEmitter } from 'events';
import { z } from 'zod';
import { Asset } from './project.asset.js';
import { Code } from './project.code.js';
import { Diagnostic } from './project.diagnostics.js';
import { Native } from './project.native.js';
import { Symbol } from './project.symbol.js';
import { StructType, Type, TypeMember } from './types.js';
import { PrimitiveName } from './types.primitives.js';
import { ok } from './util.js';

type AssetName = string;

export interface SymbolInfo {
  native: boolean;
  symbol: Symbol | TypeMember | Type;
}

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
  onDiagnostics?: (diagnostics: Diagnostic[]) => void;
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
  symbol!: Symbol;
  /**
   * All symbols that cannot be stored in the `global` struct
   * and that are not native to GML,
   * including enums, macros, asset IDs, etc. */
  readonly symbols = new Map<string, Symbol>();
  /**
   * Non-native global types, which can be referenced in JSDocs
   * and in a symbol's types. */
  readonly types = new Map<string, Type>();

  watcher?: chokidar.FSWatcher;
  protected emitter = new EventEmitter();

  protected constructor(readonly yypPath: Pathy) {}

  get ideVersion(): string {
    return this.yyp.MetaData.IDEVersion;
  }

  get projectDir(): Pathy {
    return pathy(this.yypPath).up();
  }

  createType<T extends PrimitiveName>(type: T): Type<T> {
    const baseType = this.native.types.get(type) as Type<T>;
    ok(baseType, `Unknown type '${type}'`);
    return baseType!.derive();
  }

  createStructType(subtype?: 'self' | 'instance'): StructType {
    const type = this.createType('Struct') as StructType;
    if (subtype) {
      type.addMember('self', type);
    }
    if (subtype === 'instance') {
      type.instance = true;
    }
    return type;
  }

  /**
   * Run a callback when diagnostics are emitted. Returns an unsubscribe function. */
  onDiagnostics(callback: (diagnostics: Diagnostic[]) => void): () => void {
    this.emitter.on('diagnostics', callback);
    return () => this.emitter.off('diagnostics', callback);
  }

  emitDiagnostics(diagnostics: Diagnostic[]): void {
    // Ensure they are valid diagnostics
    for (const diagnostic of diagnostics) {
      ok(diagnostic.$tag === 'diagnostic');
      ok(diagnostic.location);
      ok(diagnostic.location.file);
    }
    this.emitter.emit('diagnostics', diagnostics);
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

  /**
   * Get a named symbol from any global pool, including global
   * struct members and global types, from the project and from
   * native GML. */
  getGlobal(name: string): SymbolInfo | undefined {
    // Check symbols first, starting with project scope
    // After that, check types.
    const info: SymbolInfo = {
      native: false,
      // Only returned if found, so type-cheating for convenience.
      symbol: undefined as unknown as Symbol,
    };
    let symbol: SymbolInfo['symbol'] | undefined = this.symbols.get(name);
    if (symbol) {
      info.symbol = symbol;
      return info;
    }
    symbol = this.self.getMember(name);
    if (symbol) {
      info.symbol = symbol;
      return info;
    }
    symbol = this.native.global.get(name);
    if (symbol) {
      info.native = true;
      info.symbol = symbol;
      return info;
    }
    // Check types
    symbol = this.types.get(name);
    if (symbol) {
      info.symbol = symbol;
      return info;
    }
    symbol = this.native.types.get(name);
    if (symbol) {
      info.native = true;
      info.symbol = symbol;
      return info;
    }
    return;
  }

  /**
   * Add an entry to global tracking. Automatically adds
   * the type of the item if appropriate. If the item should
   * also be listed as a member of `global`, set `addToGlobalSelf`
   *
   */
  addGlobal(item: Symbol, addToGlobalSelf = false) {
    // Ensure it doesn't already exist
    ok(item, 'Cannot add undefined item');
    const existing = this.getGlobal(item.name);
    ok(!existing, `Global ${item.name} already exists`);
    // If it is a function or enum, add its type to the global types
    if (['Function', 'Enum'].includes(item.type.kind)) {
      this.types.set(`${item.type.kind}.${item.name}`, item.type);
    }
    // If it is a constructor, add its resulting struct type to the global types
    if (item.type.kind === 'Constructor' && item.type.constructs) {
      this.types.set(`Struct.${item.name}`, item.type.constructs);
    }
    // Add the symbol to the appropriate global pool
    if (addToGlobalSelf) {
      this.self.addMember(item.name, item.type);
    } else {
      this.symbols.set(item.name, item);
    }
  }

  addAsset(resource: Asset): void {
    const name = this.assetNameFromPath(resource.dir);
    ok(!this.assets.has(name), `Resource ${name} already exists`);
    this.assets.set(name, resource);
  }

  removeAsset(path: Pathy<any>): void {
    const name = this.assetNameFromPath(path);
    const resource = this.assets.get(name);
    ok(resource, `Resource ${name} does not exist`);
    resource.onRemove();
    this.assets.delete(name);
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
  protected async loadAssets(): Promise<void> {
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
        onInclude: (p) => assetNameToYy.set(this.assetNameFromPath(p), p),
      }),
    ]);
    this.yyp = yyp;
    const resourceWaits: Promise<any>[] = [];
    for (const resourceInfo of this.yyp.resources) {
      resourceWaits.push(
        Asset.from(
          this,
          resourceInfo,
          assetNameToYy.get(resourceInfo.id.name.toLocaleLowerCase())!,
        ).then((r) => {
          this.addAsset(r);
        }),
      );
    }
    await Promise.all(resourceWaits);
    // TODO: Link up object parent-child relationships
    for (const asset of this.assets.values()) {
      if (asset.assetType !== 'objects') {
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
    console.log(`Loaded ${this.assets.size} resources in ${Date.now() - t}ms`);
  }

  /**
   * Load the GML spec for the project's runtime version, falling
   * back on the included spec if necessary.
   */
  protected async loadGmlSpec(): Promise<void> {
    const t = Date.now();
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
      console.error('Found stitch config');
      const config = await stitchConfig.read();
      runtimeVersion = config.runtimeVersion;
    }
    if (!runtimeVersion) {
      console.error('No stitch config found, looking up runtime version');
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
        this.native = await Native.from(gmlSpecPath.absolute);
      }
    }
    // If we don't have a spec yet, use the fallback
    if (!this.native) {
      console.error('No spec found, using fallback');
      this.native = await Native.from();
      ok(this.native, 'Failed to load fallback GML spec');
    }
    this.self = this.native.types
      .get('Struct')!
      .derive()
      .named('global') as StructType;
    this.self.global = true;
    this.symbol = new Symbol('global').addType(this.self);
    this.symbols.set('global', this.symbol);
    console.log(`Loaded GML spec in ${Date.now() - t}ms`);
    this.symbol.global = true;
    this.symbol.writable = false;
  }

  protected watch(): void {
    if (this.watcher) {
      return;
    }
    const globs = [
      this.yypPath.absolute,
      this.projectDir.join('scripts/*/*.gml').absolute,
      this.projectDir.join('objects/*/*.gml').absolute,
    ];
    this.watcher = chokidar.watch(globs, {
      ignoreInitial: true,
    });
    this.watcher.on('change', async (path) => {
      const normalized = pathy(path);
      if (this.yypPath.equals(normalized)) {
        // Then we probably have some new resources to load
        // or need to delete one.
        await this.loadAssets();
      } else {
        // Then we probably have a script or object that has changed.
        // Identify which resource has changed and have it manage reloading.
        const resource = this.getAsset(normalized);
        if (!resource) {
          return;
        }
        await resource.reloadFile(normalized);
      }
    });
  }

  async initialize(options?: ProjectOptions): Promise<void> {
    if (options?.onDiagnostics) {
      this.onDiagnostics(options.onDiagnostics);
    }
    let t = Date.now();
    this.nativeWaiter = this.loadGmlSpec();
    this.yypWaiter = Yy.read(this.yypPath.absolute, 'project').then(
      (yyp) => (this.yyp = yyp),
    );
    const fileLoader = this.loadAssets();

    await Promise.all([this.nativeWaiter, fileLoader]);
    console.log(
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
    const assets = [...this.assets.values()].sort((a, b) => {
      if (a.assetType === b.assetType) {
        return a.name.localeCompare(b.name);
      }
      if (a.assetType === 'scripts') {
        return 1;
      }
      if (b.assetType === 'scripts') {
        return -1;
      }
      if (a.assetType === 'objects') {
        return 1;
      }
      if (b.assetType === 'objects') {
        return -1;
      }
      return a.name.localeCompare(b.name);
    });
    for (const asset of assets) {
      asset.updateGlobals();
    }
    console.log('Globals discovered in', Date.now() - t, 'ms');

    t = Date.now();
    // Discover all symbols and their references
    for (const asset of assets) {
      asset.updateAllSymbols();
    }
    // Update diagnostics
    for (const asset of assets) {
      asset.updateDiagnostics();
    }
    console.log('Symbols discovered in', Date.now() - t, 'ms');
    if (options?.watch) {
      this.watch();
    }
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
