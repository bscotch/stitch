import {
  stitchConfigFilename,
  stitchConfigSchema,
  type StitchConfig,
} from '@bscotch/stitch-config';
import {
  Yy,
  yySchemas,
  type YyData,
  type Yyp,
  type YypConfig,
  type YypResourceId,
} from '@bscotch/yy';
import { watch as fsWatch } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { Asset, type AssetKind, type AssetRef } from './asset.ts';
import { contentHash, ProjectTransaction } from './transaction.ts';
import {
  assert,
  exists,
  findCaseInsensitive,
  folderPathToPosix,
  GameMakerProjectError,
  hash,
  key,
  listDir,
  mapConcurrent,
  SerialQueue,
  sleep,
  toPosix,
} from './util.ts';

export interface GameMakerProjectOptions {
  /**
   * While a git operation is in progress (`.git/index.lock` exists), the
   * project waits before reading changes or writing files, for up to this
   * many milliseconds. @default 10000
   */
  gitLockTimeoutMs?: number;
  /**
   * File changes are collected until none have arrived for this many
   * milliseconds, then processed together. @default 100
   */
  changeDebounceMs?: number;
  /** Max time to keep collecting file changes before processing them. @default 2000 */
  changeMaxWaitMs?: number;
}

/** What changed about an asset */
export interface AssetChange {
  /** The yy file changed */
  yy: boolean;
  gmlFilesAdded: string[];
  gmlFilesRemoved: string[];
  /** Other files in the asset's folder that changed, e.g. sprite frames */
  files: string[];
}

export interface ProjectEventMap {
  /** A new asset was added to the project */
  assetAdded: [asset: Asset];
  /** An asset was removed from the project (including by being renamed) */
  assetRemoved: [asset: Asset];
  /** An asset's yy data or files changed */
  assetChanged: [asset: Asset, change: AssetChange];
  /** An existing GML file's content changed */
  gmlChanged: [asset: Asset, file: string];
  /** Something in the yyp other than its resource list changed (folders, configs, included files, ...) */
  yypChanged: [];
  /** The Stitch config file changed */
  configChanged: [config: StitchConfig];
  /** Files in the `datafiles` folder changed (see `syncIncludedFiles`) */
  includedFilesChanged: [];
  /** Something went wrong while processing changes */
  error: [error: Error];
}
export type ProjectEventName = keyof ProjectEventMap;
type Listener<E extends ProjectEventName> = (
  ...args: ProjectEventMap[E]
) => void;
type QueuedEvent = {
  [E in ProjectEventName]: [E, ...ProjectEventMap[E]];
}[ProjectEventName];

interface ReconcileOptions {
  /** Check the yyp even if it isn't in the list of changed paths */
  yyp?: boolean;
  /** Check everything */
  full?: boolean;
  /** The changes come from the project's own transaction */
  own?: boolean;
}

interface PendingAssetChange {
  asset: Asset;
  yy: boolean;
  relist: boolean;
  gml: Set<string>;
  files: Set<string>;
}

const SELF_WRITE_TTL_MS = 10_000;

/**
 * The state of a GameMaker project, kept in sync with what's on disk.
 *
 * @internal Use {@link GameMakerProject}, which adds methods for changing it.
 */
export class ProjectState {
  /** Absolute path to the yyp file */
  readonly yypPath: string;
  /** Absolute path to the project's folder */
  readonly dir: string;
  readonly options: Required<GameMakerProjectOptions>;

  protected _yyp!: Yyp;
  protected yypHash = '';
  protected yypMetaHash = '';
  protected _config: StitchConfig = stitchConfigSchema.parse({});
  protected configHash = '';
  protected readonly assetsByName = new Map<string, Asset>();
  protected readonly assetsByDir = new Map<string, Asset>();
  /** Resources listed in the yyp whose yy files could not be loaded */
  protected readonly unloaded = new Map<string, YypResourceId>();
  protected readonly queue = new SerialQueue();
  protected readonly listeners = new Map<ProjectEventName, Set<Function>>();
  protected readonly selfWrites = new Map<
    string,
    { hash: string | null; at: number }
  >();
  protected gitDir: string | undefined;
  /** Files that couldn't be read (e.g. mid-write), and how often we retried */
  protected readonly retries = new Map<string, number>();

  // Change coalescing
  protected readonly pending = new Set<string>();
  protected debounceTimer: NodeJS.Timeout | undefined;
  protected firstPendingAt = 0;
  protected flushing: Promise<void> | undefined;

  protected constructor(yypPath: string, options: GameMakerProjectOptions) {
    this.yypPath = path.resolve(yypPath);
    this.dir = path.dirname(this.yypPath);
    this.options = {
      gitLockTimeoutMs: 10_000,
      changeDebounceMs: 100,
      changeMaxWaitMs: 2000,
      ...options,
    };
  }

  /** Find the yyp file, given its path or its project's folder */
  protected static async findYyp(yypPathOrDir: string): Promise<string> {
    const resolved = path.resolve(yypPathOrDir);
    if (resolved.toLowerCase().endsWith('.yyp')) {
      assert(await exists(resolved), `Project file not found: ${resolved}`);
      return resolved;
    }
    const yyps = (await listDir(resolved)).filter((f) =>
      f.toLowerCase().endsWith('.yyp'),
    );
    assert(yyps.length, `No .yyp file found in ${resolved}`);
    assert(yyps.length === 1, `Multiple .yyp files found in ${resolved}`);
    return path.join(resolved, yyps[0]);
  }

  /** Read everything from disk. */
  protected async load(): Promise<void> {
    const [yypText] = await Promise.all([
      fs.readFile(this.yypPath, 'utf8'),
      this.readConfig(),
      this.findGitDir().then((d) => (this.gitDir = d)),
    ]);
    this.setYyp(yypText);
    const loaded = await mapConcurrent(this._yyp.resources, 64, (r) =>
      this.loadAsset(r.id),
    );
    for (const asset of loaded) if (asset) this.registerAsset(asset);
  }

  // --- Project data ---

  /** The yyp data, as read from disk. Do not mutate! */
  get yyp(): Yyp {
    return this._yyp;
  }

  get name(): string {
    return this._yyp.name;
  }

  /** The GameMaker IDE version that last saved the project */
  get ideVersion(): string {
    return this._yyp.MetaData.IDEVersion;
  }

  /** The project's Stitch config (`stitch.config.json`) */
  get config(): StitchConfig {
    return this._config;
  }

  /** The names of the project's build configurations */
  get configs(): string[] {
    const names: string[] = [];
    const visit = (config: YypConfig) => {
      names.push(config.name);
      config.children?.forEach(visit);
    };
    visit(this._yyp.configs);
    return names;
  }

  /** The project's asset-tree folders, in POSIX form (`my/folder`) */
  get folders(): string[] {
    return this._yyp.Folders.map((f) => folderPathToPosix(f.folderPath));
  }

  /** The project's "Included Files", as listed in the yyp */
  get includedFiles(): Yyp['IncludedFiles'] {
    return this._yyp.IncludedFiles;
  }

  get audioGroups(): Yyp['AudioGroups'] {
    return this._yyp.AudioGroups;
  }

  get textureGroups(): Yyp['TextureGroups'] {
    return this._yyp.TextureGroups;
  }

  /** The display name set in the project's Windows options, if any */
  async getWindowsName(): Promise<string | undefined> {
    const file = path.join(this.dir, 'options/windows/options_windows.yy');
    try {
      const data = Yy.parse(await fs.readFile(file, 'utf8')) as {
        option_windows_display_name?: string;
      };
      return data.option_windows_display_name;
    } catch {
      return undefined;
    }
  }

  // --- Assets ---

  /** All assets, in no particular order */
  get assets(): IterableIterator<Asset> {
    return this.assetsByName.values();
  }

  get assetCount(): number {
    return this.assetsByName.size;
  }

  listAssets<K extends AssetKind>(kind?: K): Asset<K>[] {
    const all = [...this.assetsByName.values()];
    return (kind ? all.filter((a) => a.kind === kind) : all) as Asset<K>[];
  }

  /**
   * Resources listed in the yyp whose yy files could not be read (e.g.
   * because they are missing).
   */
  get unloadedResources(): YypResourceId[] {
    return [...this.unloaded.values()];
  }

  /** Get an asset by name (case-insensitive) */
  getAsset<K extends AssetKind = AssetKind>(
    ref: AssetRef<K> | undefined | null,
  ): Asset<K> | undefined {
    if (!ref) return undefined;
    if (typeof ref !== 'string') {
      return this.assetsByName.get(key(ref.name)) === ref ? ref : undefined;
    }
    return this.assetsByName.get(key(ref)) as Asset<K> | undefined;
  }

  /** Get an asset by name, throwing if it doesn't exist */
  requireAsset<K extends AssetKind = AssetKind>(
    ref: AssetRef<K>,
    kind?: K,
  ): Asset<K> {
    const asset = this.getAsset(ref);
    const name = typeof ref === 'string' ? ref : ref.name;
    assert(asset, `Asset "${name}" does not exist`);
    assert(
      !kind || asset.kind === kind,
      `Asset "${name}" is not of kind "${kind}"`,
    );
    return asset;
  }

  /** Get the asset that a file belongs to (its yy file, GML files, etc.) */
  getAssetByPath(file: string): Asset | undefined {
    const parts = toPosix(path.relative(this.dir, path.resolve(file))).split(
      '/',
    );
    if (parts.length < 2 || parts[0] === '..') return undefined;
    return this.assetsByDir.get(key(`${parts[0]}/${parts[1]}`));
  }

  /** For an object, its parent object */
  getParent(object: AssetRef): Asset<'objects'> | undefined {
    const parent = this.getAsset(this.getAsset(object)?.parentName);
    return parent?.isKind('objects') ? parent : undefined;
  }

  /** For an object, its ancestors, starting with its parent */
  getAncestors(object: AssetRef): Asset<'objects'>[] {
    const ancestors: Asset<'objects'>[] = [];
    const seen = new Set<Asset>();
    let current = this.getParent(object);
    while (current && !seen.has(current)) {
      ancestors.push(current);
      seen.add(current);
      current = this.getParent(current);
    }
    return ancestors;
  }

  /** For an object, the objects whose parent it is */
  getChildren(object: AssetRef): Asset<'objects'>[] {
    const name = key(typeof object === 'string' ? object : object.name);
    return this.listAssets('objects').filter(
      (o) => o.parentName && key(o.parentName) === name,
    );
  }

  /** List the assets in a folder (`my/folder`) */
  listAssetsInFolder(
    folder: string,
    options?: { recursive?: boolean },
  ): Asset[] {
    const target = key(folderPathToPosix(folder));
    return this.listAssets().filter((a) =>
      options?.recursive ? a.isInFolder(target) : key(a.folder) === target,
    );
  }

  // --- Events ---

  /** Listen for an event. Returns a function that removes the listener. */
  on<E extends ProjectEventName>(event: E, listener: Listener<E>): () => void {
    let set = this.listeners.get(event);
    if (!set) this.listeners.set(event, (set = new Set()));
    set.add(listener);
    return () => set.delete(listener);
  }

  protected emit(events: QueuedEvent[]) {
    for (const [name, ...args] of events) {
      for (const listener of this.listeners.get(name) || []) {
        try {
          listener(...args);
        } catch (err) {
          if (name !== 'error') this.emitError(err);
        }
      }
    }
  }

  protected emitError(err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    if (!this.listeners.get('error')?.size) return;
    this.emit([['error', error]]);
  }

  // --- Changes from outside ---

  /**
   * Tell the project that files have changed on disk (e.g. from an editor's
   * file watcher). Changes are collected for a moment, then processed
   * together: the project compares disk with what it has in memory, and
   * emits events for whatever actually changed.
   *
   * Changes made by the project itself are recognized and ignored.
   */
  notifyChanged(files: string | Iterable<string>): void {
    for (const file of typeof files === 'string' ? [files] : files) {
      this.pending.add(path.resolve(file));
    }
    if (!this.pending.size) return;
    const now = Date.now();
    if (!this.debounceTimer) this.firstPendingAt = now;
    clearTimeout(this.debounceTimer);
    const wait = Math.min(
      this.options.changeDebounceMs,
      Math.max(0, this.firstPendingAt + this.options.changeMaxWaitMs - now),
    );
    this.debounceTimer = setTimeout(() => {
      this.debounceTimer = undefined;
      this.flushing = this.queue
        .run(() => this.reconcilePending())
        .catch((err) => this.emitError(err))
        .finally(() => (this.flushing = undefined));
    }, wait);
  }

  /**
   * Watch the project folder for changes, using Node's file watcher.
   * (Editors with their own file watchers can call {@link notifyChanged}
   * instead.) Returns a function that stops watching.
   */
  watch(): () => void {
    const watcher = fsWatch(
      this.dir,
      { recursive: true },
      (_event, filename) => {
        if (!filename) return;
        const first = toPosix(filename.toString()).split('/')[0];
        if (first.startsWith('.') || first === 'node_modules') return;
        this.notifyChanged(path.join(this.dir, filename.toString()));
      },
    );
    watcher.on('error', (err) => this.emitError(err));
    return () => watcher.close();
  }

  /**
   * Compare disk with memory and emit events for any differences. With no
   * arguments, everything is checked. Waits for queued changes to finish.
   */
  async reconcile(files?: Iterable<string>): Promise<void> {
    await this.queue.run(async () => {
      await this.waitForGit();
      if (files) {
        for (const file of files) this.pending.add(path.resolve(file));
        await this.reconcilePending();
      } else {
        this.pending.clear();
        await this.reconcileNow([], { full: true });
      }
    });
  }

  /** Resolves once all pending changes and transactions have been processed */
  async idle(): Promise<void> {
    while (this.debounceTimer || this.flushing || this.queue.busy) {
      if (this.debounceTimer) await sleep(this.options.changeDebounceMs);
      await this.flushing;
      await this.queue.idle();
    }
  }

  protected async reconcilePending(): Promise<void> {
    await this.waitForGit();
    const files = [...this.pending];
    this.pending.clear();
    if (files.length) await this.reconcileNow(files, {});
  }

  // --- Transactions ---

  /**
   * Run a set of changes as a transaction. Transactions (and the processing
   * of external changes) run one at a time, in order.
   *
   * Before the transaction runs, pending external changes are processed and
   * any in-progress git operation is waited for. Afterwards, the project's
   * state is updated from disk and events are emitted.
   *
   * If `fn` throws, what can be undone is undone, and the error is rethrown.
   */
  async transaction<T>(fn: (tx: ProjectTransaction) => Promise<T>): Promise<T> {
    return await this.queue.run(async () => {
      await this.reconcilePending();
      const tx = new ProjectTransaction({
        dir: this.dir,
        yypPath: this.yypPath,
        readYypFresh: () => this.readYypFresh(),
        parseYy: (text, kind) => this.parseYy(text, kind),
        recordSelfWrite: (file, content) => this.recordSelfWrite(file, content),
      });
      let result: T;
      try {
        result = await fn(tx);
        const { errors } = await tx.commit();
        for (const err of errors) this.emitError(err);
      } catch (err) {
        const { errors } = await tx.rollback();
        for (const e of errors) this.emitError(e);
        await this.reconcileNow(tx.touched, { yyp: true, own: true });
        throw err;
      }
      await this.reconcileNow(tx.touched, { yyp: tx.usesYyp, own: true });
      return result;
    });
  }

  protected async readYypFresh(): Promise<Yyp> {
    const text = await fs.readFile(this.yypPath, 'utf8');
    return hash(text) === this.yypHash
      ? structuredClone(this._yyp)
      : Yy.parse(text, 'project');
  }

  protected parseYy<K extends AssetKind>(text: string, kind: K): YyData<K> {
    return Yy.parse(text, kind in yySchemas ? kind : undefined) as YyData<K>;
  }

  protected recordSelfWrite(file: string, content: string | Buffer | null) {
    this.selfWrites.set(key(path.resolve(file)), {
      hash: contentHash(content),
      at: Date.now(),
    });
  }

  /**
   * If a reported change to `file` is one the project made itself (and the
   * file hasn't changed since), forget it and return `true`.
   */
  protected async isOwnWrite(file: string): Promise<boolean> {
    const k = key(file);
    const record = this.selfWrites.get(k);
    if (!record) return false;
    if (Date.now() - record.at > SELF_WRITE_TTL_MS) {
      this.selfWrites.delete(k);
      return false;
    }
    let current: string | null;
    try {
      current = hash(await fs.readFile(file));
    } catch {
      current = null;
    }
    if (current !== record.hash) return false;
    this.selfWrites.delete(k);
    return true;
  }

  // --- Git ---

  protected async findGitDir(): Promise<string | undefined> {
    let dir = this.dir;
    while (true) {
      const candidate = path.join(dir, '.git');
      try {
        const stat = await fs.stat(candidate);
        if (stat.isDirectory()) return candidate;
        // Worktrees and submodules have a `.git` file pointing to the real dir
        const content = await fs.readFile(candidate, 'utf8');
        const match = content.match(/^gitdir:\s*(.+)$/m);
        if (match) return path.resolve(dir, match[1].trim());
      } catch {
        // Not here
      }
      const parent = path.dirname(dir);
      if (parent === dir) return undefined;
      dir = parent;
    }
  }

  /** Wait while a git operation (e.g. a pull) is in progress */
  protected async waitForGit(): Promise<void> {
    if (!this.gitDir) return;
    const lock = path.join(this.gitDir, 'index.lock');
    const start = Date.now();
    while (await exists(lock)) {
      if (Date.now() - start > this.options.gitLockTimeoutMs) return;
      await sleep(50);
    }
  }

  // --- Reconciling memory with disk ---

  protected setYyp(text: string) {
    this._yyp = Yy.parse(text, 'project');
    this.yypHash = hash(text);
    this.yypMetaHash = hash(Yy.stringify({ ...this._yyp, resources: [] }));
  }

  protected async readConfig(): Promise<boolean> {
    const file = path.join(this.dir, stitchConfigFilename);
    let text = '';
    try {
      text = await fs.readFile(file, 'utf8');
    } catch {
      // No config
    }
    const h = hash(text);
    if (h === this.configHash) return false;
    this.configHash = h;
    if (!text) {
      this._config = stitchConfigSchema.parse({});
      return true;
    }
    try {
      this._config = stitchConfigSchema.parse(JSON.parse(text));
    } catch (err) {
      this.emitError(
        new GameMakerProjectError(`Invalid Stitch config: ${file}`, {
          cause: err,
        }),
      );
      this._config = stitchConfigSchema.parse({});
    }
    return true;
  }

  protected registerAsset(asset: Asset) {
    this.assetsByName.set(key(asset.name), asset);
    this.assetsByDir.set(key(this.relativeDir(asset)), asset);
    this.unloaded.delete(key(asset.name));
  }

  protected unregisterAsset(asset: Asset) {
    if (this.assetsByName.get(key(asset.name)) === asset) {
      this.assetsByName.delete(key(asset.name));
    }
    const dirKey = key(this.relativeDir(asset));
    if (this.assetsByDir.get(dirKey) === asset) this.assetsByDir.delete(dirKey);
  }

  protected relativeDir(asset: Asset): string {
    return toPosix(path.relative(this.dir, asset.dir));
  }

  /** Find a resource's yy file (case-insensitively, if needed) */
  protected async findYy(id: YypResourceId): Promise<string | undefined> {
    const expected = path.join(this.dir, id.path);
    if (await exists(expected)) return expected;
    const [kind] = id.path.split('/');
    const dir = await findCaseInsensitive(path.join(this.dir, kind), id.name);
    return dir && (await findCaseInsensitive(dir, `${id.name}.yy`));
  }

  protected async loadAsset(id: YypResourceId): Promise<Asset | undefined> {
    const kind = id.path.split('/')[0] as AssetKind;
    try {
      const yyPath = await this.findYy(id);
      assert(yyPath, `Could not find the yy file for "${id.path}"`);
      const text = await fs.readFile(yyPath, 'utf8');
      const asset = new Asset({
        kind,
        id: { name: id.name, path: id.path },
        yyPath,
        yy: this.parseYy(text, kind),
        yyHash: hash(text),
        dirEntries: await listDir(path.dirname(yyPath)),
      });
      return asset;
    } catch (err) {
      this.unloaded.set(key(id.name), { name: id.name, path: id.path });
      this.emitError(
        new GameMakerProjectError(`Could not load asset "${id.name}"`, {
          cause: err,
        }),
      );
      return undefined;
    }
  }

  /**
   * Update memory from disk for the given changed files, emitting events
   * for whatever actually changed.
   */
  protected async reconcileNow(
    files: Iterable<string>,
    options: ReconcileOptions,
  ): Promise<void> {
    const events: QueuedEvent[] = [];
    const changes = new Map<Asset, PendingAssetChange>();
    const change = (asset: Asset) => {
      let c = changes.get(asset);
      if (!c) {
        c = {
          asset,
          yy: false,
          relist: false,
          gml: new Set(),
          files: new Set(),
        };
        changes.set(asset, c);
      }
      return c;
    };

    const list = [...files].map((f) => path.resolve(f));
    const yypKey = key(this.yypPath);
    if (options.yyp || options.full || list.some((f) => key(f) === yypKey)) {
      await this.reconcileYyp(events, options);
    }

    const addedNow = new Set(
      events.flatMap((e) => (e[0] === 'assetAdded' ? [e[1]] : [])),
    );
    let datafiles = false;
    for (const file of list) {
      const relative = toPosix(path.relative(this.dir, file));
      const parts = relative.split('/');
      if (parts[0] === '..' || key(file) === yypKey) continue;
      if (key(relative) === key(stitchConfigFilename)) {
        if (await this.readConfig()) {
          events.push(['configChanged', this._config]);
        }
        continue;
      }
      if (key(parts[0]) === 'datafiles') {
        datafiles = true;
        continue;
      }
      if (parts.length < 2) continue;
      const asset = this.assetsByDir.get(key(`${parts[0]}/${parts[1]}`));
      if (asset && addedNow.has(asset)) continue; // Just loaded fresh
      if (!asset) {
        // Maybe an asset that couldn't be loaded before
        await this.retryUnloaded(parts[1], events);
        continue;
      }
      if (parts.length === 2) {
        // The asset's folder itself changed (e.g. it was replaced)
        const c = change(asset);
        c.yy = true;
        c.relist = true;
      } else if (key(file) === key(asset.yyPath)) {
        change(asset).yy = true;
      } else if (!options.own && (await this.isOwnWrite(file))) {
        continue;
      } else if (file.toLowerCase().endsWith('.gml')) {
        change(asset).gml.add(file);
      } else {
        change(asset).files.add(file);
      }
    }
    if (options.full) {
      for (const asset of this.assetsByName.values()) {
        const c = change(asset);
        c.yy = true;
        c.relist = true;
      }
      if (await this.readConfig()) events.push(['configChanged', this._config]);
    }
    if (datafiles) events.push(['includedFilesChanged']);

    await mapConcurrent([...changes.values()], 32, (c) =>
      this.reconcileAsset(c, events),
    );
    this.emit(events);
  }

  /** Check a file again soon (a few times at most), e.g. after a partial read */
  protected retryLater(file: string) {
    const k = key(file);
    const count = this.retries.get(k) ?? 0;
    if (count >= 3) {
      this.retries.delete(k);
      return;
    }
    this.retries.set(k, count + 1);
    this.notifyChanged(file);
  }

  protected async retryUnloaded(dirName: string, events: QueuedEvent[]) {
    const id = this.unloaded.get(key(dirName));
    if (!id || this.assetsByName.has(key(id.name))) return;
    const asset = await this.loadAsset(id);
    if (asset) {
      this.registerAsset(asset);
      events.push(['assetAdded', asset]);
    }
  }

  protected async reconcileYyp(
    events: QueuedEvent[],
    options: ReconcileOptions,
  ): Promise<void> {
    let text: string;
    try {
      text = await fs.readFile(this.yypPath, 'utf8');
    } catch (err) {
      this.emitError(err);
      return;
    }
    if (hash(text) === this.yypHash && !options.full) return;
    const oldMeta = this.yypMetaHash;
    try {
      this.setYyp(text);
    } catch (err) {
      // Probably mid-write. Try again shortly.
      this.emitError(
        new GameMakerProjectError('Could not parse the yyp file', {
          cause: err,
        }),
      );
      this.retryLater(this.yypPath);
      return;
    }
    this.retries.delete(key(this.yypPath));
    if (this.yypMetaHash !== oldMeta) events.push(['yypChanged']);

    // Find added and removed resources
    const listed = new Map<string, YypResourceId>();
    for (const { id } of this._yyp.resources) listed.set(key(id.name), id);
    for (const asset of [...this.assetsByName.values()]) {
      const id = listed.get(key(asset.name));
      if (
        !id ||
        key(id.path) !== key(asset.id.path) ||
        id.name !== asset.name
      ) {
        this.unregisterAsset(asset);
        events.push(['assetRemoved', asset]);
      }
    }
    for (const name of [...this.unloaded.keys()]) {
      if (!listed.has(name)) this.unloaded.delete(name);
    }
    const added = [...listed.values()].filter(
      (id) => !this.assetsByName.has(key(id.name)),
    );
    const loaded = await mapConcurrent(added, 64, (id) => this.loadAsset(id));
    for (const asset of loaded) {
      if (!asset) continue;
      this.registerAsset(asset);
      events.push(['assetAdded', asset]);
    }
  }

  protected async reconcileAsset(
    c: PendingAssetChange,
    events: QueuedEvent[],
  ): Promise<void> {
    const { asset } = c;
    if (!this.assetsByName.has(key(asset.name))) return; // Removed meanwhile
    const change: AssetChange = {
      yy: false,
      gmlFilesAdded: [],
      gmlFilesRemoved: [],
      files: [...c.files],
    };
    const oldFiles = [...asset.gmlFiles];
    const oldGml = new Set(oldFiles.map(key));
    let relist = c.relist || c.gml.size > 0;
    if (c.yy) {
      try {
        const text = await fs.readFile(asset.yyPath, 'utf8');
        const h = hash(text);
        if (h !== asset.yyHash) {
          asset.update({
            yy: this.parseYy(text, asset.kind),
            yyHash: h,
            dirEntries: await listDir(asset.dir),
          });
          change.yy = true;
          relist = false;
        }
      } catch (err) {
        // Missing (e.g. mid-delete) or mid-write: the yyp or a later
        // change event will sort it out.
        if (await exists(asset.yyPath)) {
          this.emitError(
            new GameMakerProjectError(`Could not read ${asset.yyPath}`, {
              cause: err,
            }),
          );
          this.retryLater(asset.yyPath);
        }
      }
    }
    if (relist) asset.updateGmlFiles(await listDir(asset.dir));
    const newGml = new Set(asset.gmlFiles.map(key));
    change.gmlFilesAdded = asset.gmlFiles.filter((f) => !oldGml.has(key(f)));
    change.gmlFilesRemoved = oldFiles.filter((f) => !newGml.has(key(f)));

    if (
      change.yy ||
      change.gmlFilesAdded.length ||
      change.gmlFilesRemoved.length ||
      change.files.length
    ) {
      events.push(['assetChanged', asset, change]);
    }
    for (const file of c.gml) {
      const k = key(file);
      if (newGml.has(k) && oldGml.has(k)) {
        events.push(['gmlChanged', asset, file]);
      }
    }
  }
}
