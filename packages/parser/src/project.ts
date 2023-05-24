import { fetchReleasesSummaryWithNotes } from '@bscotch/gamemaker-releases';
import { pathy, Pathy } from '@bscotch/pathy';
import { GameMakerLauncher } from '@bscotch/stitch-launcher';
import { Yy, Yyp } from '@bscotch/yy';
import { ok } from 'assert';
import chokidar from 'chokidar';
import { EventEmitter } from 'events';
import { z } from 'zod';
import { Gml } from './gml.js';
import { GmlFile } from './project.gml.js';
import { GameMakerResource } from './project.resource.js';
import { GlobalSelf } from './project.selfs.js';
import { Diagnostic } from './types.legacy.js';

type ResourceName = string;

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

export class GameMakerProjectParser {
  yyp!: Yyp;
  spec!: Gml;
  readonly resources = new Map<ResourceName, GameMakerResource>();
  self = new GlobalSelf(this);
  watcher!: chokidar.FSWatcher;
  protected emitter = new EventEmitter();

  protected constructor(readonly yypPath: Pathy) {}

  get ideVersion(): string {
    return this.yyp.MetaData.IDEVersion;
  }

  get projectDir(): Pathy {
    return pathy(this.yypPath).up();
  }

  /**
   * Run a callback when diagnostics are emitted. Returns an unsubscribe function. */
  onDiagnostics(callback: (diagnostics: Diagnostic[]) => void): () => void {
    this.emitter.on('diagnostics', callback);
    return () => this.emitter.off('diagnostics', callback);
  }

  emitDiagnostics(diagnostics: Diagnostic[]): void {
    this.emitter.emit('diagnostics', diagnostics);
  }

  getResource(path: Pathy<any>): GameMakerResource | undefined {
    return this.resources.get(this.resourceNameFromPath(path));
  }

  getGmlFile(path: Pathy<any>): GmlFile | undefined {
    const resource = this.getResource(path);
    if (!resource) {
      return;
    }
    return resource.getGmlFile(path);
  }

  addResource(resource: GameMakerResource): void {
    const name = this.resourceNameFromPath(resource.dir);
    ok(!this.resources.has(name), `Resource ${name} already exists`);
    this.resources.set(name, resource);
  }

  removeResource(path: Pathy<any>): void {
    const name = this.resourceNameFromPath(path);
    const resource = this.resources.get(name);
    ok(resource, `Resource ${name} does not exist`);
    resource.onRemove();
    this.resources.delete(name);
  }

  /**
   * The name of a resource, *in lower case*, from
   * a path. This is used as the key for looking up resources.
   *
   * The path can be to the asset's folder, or to any file within
   * that folder.
   */
  resourceNameFromPath(path: Pathy<any>): string {
    const parts = path.relativeFrom(this.projectDir).split(/[/\\]+/);
    return parts[1].toLocaleLowerCase();
  }

  /**
   * When first creating an instance, we need to get all project file
   * content into memory for fast access. In particular, we need all
   * yyp, yy, and gml files for scripts and objects. For other asset types
   * we just need their names and yyp filepaths.
   */
  protected async loadResources(): Promise<void> {
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
        onInclude: (p) => assetNameToYy.set(this.resourceNameFromPath(p), p),
      }),
    ]);
    this.yyp = yyp;
    const resourceWaits: Promise<any>[] = [];
    for (const resourceInfo of this.yyp.resources) {
      resourceWaits.push(
        GameMakerResource.from(
          this,
          resourceInfo,
          assetNameToYy.get(resourceInfo.id.name.toLocaleLowerCase())!,
        ).then((r) => {
          this.addResource(r);
        }),
      );
    }
    await Promise.all(resourceWaits);
    console.log(
      `Loaded ${this.resources.size} resources in ${Date.now() - t}ms`,
    );
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
      const releases = await fetchReleasesSummaryWithNotes();
      const usingRelease = releases.find(
        (r) => r.ide.version === this.ideVersion,
      );
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
        this.spec = await Gml.from(gmlSpecPath.absolute);
      }
    }
    // If we don't have a spec yet, use the fallback
    if (!this.spec) {
      console.error('No spec found, using fallback');
      this.spec = await Gml.from(
        GameMakerProjectParser.fallbackGmlSpecPath.absolute,
      );
    }
    console.log(`Loaded GML spec in ${Date.now() - t}ms`);
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
        await this.loadResources();
      } else {
        // Then we probably have a script or object that has changed.
        // Identify which resource has changed and have it manage reloading.
        const resource = this.getResource(normalized);
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
    const fileLoader = this.loadResources();
    const specLoaderWait = this.loadGmlSpec();

    await Promise.all([specLoaderWait, fileLoader]);
    console.log(
      'Resources',
      this.resources.size,
      'loaded files in',
      Date.now() - t,
      'ms',
    );

    t = Date.now();
    // Discover all globals
    for (const [, resource] of this.resources) {
      resource.updateGlobals();
    }
    console.log('Globals discovered in', Date.now() - t, 'ms');

    t = Date.now();
    // Discover all symbols and their references
    for (const [, resource] of this.resources) {
      resource.updateAllSymbols();
    }
    console.log('Symbols discovered in', Date.now() - t, 'ms');
    if (options?.watch) {
      this.watch();
    }
  }

  static async initialize(
    yypPath: string,
    options?: ProjectOptions,
  ): Promise<GameMakerProjectParser> {
    let path = pathy(yypPath);
    if (await path.isDirectory()) {
      const children = await path.listChildren();
      path = children.find((p) => p.hasExtension('yyp'))!;
      ok(path, 'No yyp file found in project directory');
    }
    await path.exists({ assert: true });
    const project = new GameMakerProjectParser(path);
    await project.initialize(options);
    return project;
  }

  static readonly fallbackGmlSpecPath = pathy(import.meta.url).resolveTo(
    '../../assets/GmlSpec.xml',
  );
}
