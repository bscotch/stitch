import { Yy, yypFolderSchema, type YyData, type Yyp } from '@bscotch/yy';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { Asset, AssetKind } from './asset.ts';
import {
  folderPathToPosix,
  folderPathToYy,
  hash,
  key,
  listFilesRecursively,
  splitPath,
  toPosix,
} from './util.ts';

/** The `parent` field of an asset's yy file: its folder (or the project) */
export interface ParentRef {
  name: string;
  path: string;
}

/** @internal How a transaction talks to its project */
export interface TransactionHost {
  readonly dir: string;
  readonly yypPath: string;
  /** Read the yyp from disk, returning a private copy */
  readYypFresh(): Promise<Yyp>;
  /** Parse a yy file's text with the right schema for its kind */
  parseYy<K extends AssetKind>(text: string, kind: K): YyData<K>;
  /** Record a write made by the project itself, so the watcher can ignore it */
  recordSelfWrite(file: string, content: string | Buffer | null): void;
}

interface StagedYy {
  path: string;
  kind: AssetKind;
  data: unknown;
}

/**
 * A set of changes to a project, applied as one unit.
 *
 * Transactions run one at a time. Each one reads the yyp and any yy files
 * it changes *fresh from disk*, so changes made outside the project (by
 * GameMaker, git, etc.) are never overwritten with stale data.
 *
 * yy/yyp changes are staged and written on commit (yy files first, then the
 * yyp, so the yyp never lists an asset whose yy file doesn't exist yet).
 * Other files are written immediately.
 */
export class ProjectTransaction {
  protected _yyp?: Yyp;
  protected readonly yys = new Map<string, StagedYy>();
  protected readonly staged = new Set<string>();
  protected readonly rollbacks: (() => Promise<unknown>)[] = [];
  protected readonly afterCommits: (() => Promise<unknown>)[] = [];
  /** Absolute paths of every file this transaction created, changed or deleted */
  readonly touched = new Set<string>();
  readonly host: TransactionHost;

  constructor(host: TransactionHost) {
    this.host = host;
  }

  /** The project's yyp, read fresh from disk. Changes are written on commit. */
  async yyp(): Promise<Yyp> {
    this._yyp ||= await this.host.readYypFresh();
    return this._yyp;
  }

  /** `true` if {@link yyp} was used, meaning the yyp may need to be written */
  get usesYyp(): boolean {
    return !!this._yyp;
  }

  /**
   * Ensure an asset-tree folder (and its parents) exist in the yyp,
   * returning the `parent` value for assets in it. An empty path means the
   * project root.
   */
  async ensureFolder(folder: string | string[]): Promise<ParentRef> {
    const parts = splitPath(folder);
    const yyp = await this.yyp();
    if (!parts.length) {
      return { name: yyp.name, path: path.basename(this.host.yypPath) };
    }
    let current = '';
    let name = '';
    for (const part of parts) {
      current = current ? `${current}/${part}` : part;
      const folderPath = folderPathToYy(current);
      const existing = yyp.Folders.find(
        (f) => key(f.folderPath) === key(folderPath),
      );
      if (existing) {
        // Keep the existing casing
        current = folderPathToPosix(existing.folderPath);
        name = existing.name;
      } else {
        yyp.Folders.push(yypFolderSchema.parse({ folderPath, name: part }));
        name = part;
      }
    }
    return { name, path: folderPathToYy(current) };
  }

  /** An asset's yy data, read fresh from disk. Stage changes with {@link stageYy}. */
  async yy<K extends AssetKind>(asset: Asset<K>): Promise<YyData<K>> {
    return await this.yyAt(asset.yyPath, asset.kind);
  }

  /** The yy data at a path, read fresh from disk (or as already staged) */
  async yyAt<K extends AssetKind>(file: string, kind: K): Promise<YyData<K>> {
    const k = key(file);
    let entry = this.yys.get(k);
    if (!entry) {
      const text = await fs.readFile(file, 'utf8');
      entry = { path: file, kind, data: this.host.parseYy(text, kind) };
      this.yys.set(k, entry);
    }
    return entry.data as YyData<K>;
  }

  /** Stage yy data to be written on commit */
  stageYy<K extends AssetKind>(file: string, kind: K, data: YyData<K>): void {
    const k = key(file);
    this.yys.set(k, { path: file, kind, data });
    this.staged.add(k);
  }

  /** The staged yy files, in the order they were staged */
  get stagedYys(): StagedYy[] {
    return [...this.staged].map((k) => this.yys.get(k)!);
  }

  /** Write a file now (creating directories as needed) */
  async writeFile(file: string, content: string | Buffer): Promise<void> {
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, content);
    this.host.recordSelfWrite(file, content);
    this.touched.add(file);
  }

  /** Copy a file now */
  async copyFile(from: string, to: string): Promise<void> {
    await this.writeFile(to, await fs.readFile(from));
  }

  /**
   * Copy a directory's files into a new directory now, optionally renaming
   * them. `rename` receives and returns POSIX paths relative to the
   * directories. The new directory is removed if the transaction fails.
   */
  async copyDir(
    from: string,
    to: string,
    rename: (relative: string) => string = (r) => r,
  ): Promise<void> {
    this.onRollback(() => fs.rm(to, { recursive: true, force: true }));
    for (const file of await listFilesRecursively(from)) {
      const relative = rename(toPosix(path.relative(from, file)));
      await this.copyFile(file, path.join(to, relative));
    }
  }

  /** Rename (move) a file or directory now. Undone if the transaction fails. */
  async rename(from: string, to: string): Promise<void> {
    const files = await listFilesRecursively(from);
    await fs.mkdir(path.dirname(to), { recursive: true });
    await fs.rename(from, to);
    this.onRollback(() => fs.rename(to, from));
    for (const file of files) {
      const moved = path.join(to, path.relative(from, file));
      this.host.recordSelfWrite(file, null);
      this.host.recordSelfWrite(moved, await fs.readFile(moved));
      this.touched.add(file);
      this.touched.add(moved);
    }
    if (!files.length) {
      this.touched.add(from);
      this.touched.add(to);
    }
  }

  /** Delete a file or directory, after a successful commit */
  deleteOnCommit(target: string): void {
    this.afterCommits.push(async () => {
      for (const file of await listFilesRecursively(target)) {
        this.host.recordSelfWrite(file, null);
        this.touched.add(file);
      }
      this.host.recordSelfWrite(target, null);
      this.touched.add(target);
      await fs.rm(target, { recursive: true, force: true, maxRetries: 5 });
    });
  }

  /** Register an action to undo a change if the transaction fails */
  onRollback(undo: () => Promise<unknown>): void {
    this.rollbacks.push(undo);
  }

  /** @internal Write staged changes. Called by the project. */
  async commit(): Promise<{ errors: unknown[] }> {
    const format = this._yyp;
    for (const { path: file, kind, data } of this.stagedYys) {
      if (await writeIfChanged(file, Yy.stringify(data, kind, format))) {
        this.touched.add(file);
      }
    }
    if (this._yyp) {
      const text = Yy.stringify(this._yyp, 'project');
      if (await writeIfChanged(this.host.yypPath, text)) {
        this.touched.add(this.host.yypPath);
      }
    }
    const errors: unknown[] = [];
    for (const action of this.afterCommits) {
      try {
        await action();
      } catch (err) {
        errors.push(err);
      }
    }
    return { errors };
  }

  /** @internal Undo what can be undone. Called by the project. */
  async rollback(): Promise<{ errors: unknown[] }> {
    const errors: unknown[] = [];
    for (const undo of [...this.rollbacks].reverse()) {
      try {
        await undo();
      } catch (err) {
        errors.push(err);
      }
    }
    return { errors };
  }
}

async function writeIfChanged(file: string, text: string): Promise<boolean> {
  try {
    if ((await fs.readFile(file, 'utf8')) === text) return false;
  } catch {
    // Doesn't exist yet
  }
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, text);
  return true;
}

/** @internal */
export function contentHash(content: string | Buffer | null): string | null {
  return content === null ? null : hash(content);
}
