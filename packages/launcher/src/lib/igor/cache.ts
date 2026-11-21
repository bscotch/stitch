/**
 * @file Stitch's own cache for Igor's `--cache`/`--temp`/`--of` dirs.
 *
 * One entry per project, in the OS's cache dir (machine-local, outside the
 * project, and treated as disposable by OS cleanup tools). An entry is
 * wiped when a project is built with a different runtime than last time,
 * and entries unused for a while (or whose project is gone) are pruned
 * automatically whenever Igor runs.
 */
import { createHash } from 'node:crypto';
import { mkdir, readdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { dirSize, exists, readJson, writeJsonAtomic } from '../fsUtil.ts';
import {
  resolveOptions,
  type AnyLauncherOptions,
  type ResolvedOptions,
} from '../options.ts';

const metaFileName = 'stitch-meta.json';

export interface IgorCacheMeta {
  projectPath: string;
  lastUsedAt: number;
  runtimeVersion: string;
}

export interface IgorCacheEntry {
  /** The entry's dir name */
  key: string;
  directory: string;
  /** From the entry's metadata. Missing if the metadata is unreadable. */
  meta?: IgorCacheMeta;
  /** Present when requested via {@link getIgorCacheInfo} */
  sizeBytes?: number;
}

export interface IgorCacheDirs {
  entry: IgorCacheEntry;
  cache: string;
  temp: string;
  out: string;
}

/** Normalize a project path for hashing (case-insensitive on Windows) */
function normalizeProjectPath(projectPath: string, opts: ResolvedOptions) {
  const resolved = opts.platform.path.resolve(projectPath);
  return opts.platform.os === 'windows' ? resolved.toLowerCase() : resolved;
}

/** `<projectName>-<first 8 hex chars of sha256(normalized .yyp path)>` */
export function igorCacheKey(
  projectPath: string,
  opts: ResolvedOptions,
): string {
  const p = opts.platform.path;
  const name = p
    .basename(projectPath, p.extname(projectPath))
    .replace(/[^\w.-]+/g, '_');
  const hash = createHash('sha256')
    .update(normalizeProjectPath(projectPath, opts))
    .digest('hex')
    .slice(0, 8);
  return `${name}-${hash}`;
}

async function readEntry(
  directory: string,
  key: string,
): Promise<IgorCacheEntry> {
  const meta = await readJson<IgorCacheMeta>(
    path.join(directory, metaFileName),
  );
  const valid =
    meta &&
    typeof meta.projectPath === 'string' &&
    typeof meta.lastUsedAt === 'number' &&
    typeof meta.runtimeVersion === 'string';
  return { key, directory, meta: valid ? meta : undefined };
}

async function listEntries(opts: ResolvedOptions): Promise<IgorCacheEntry[]> {
  let names: string[];
  try {
    names = await readdir(opts.igorCacheDir);
  } catch {
    return [];
  }
  return await Promise.all(
    names.map((name) =>
      readEntry(opts.platform.path.join(opts.igorCacheDir, name), name),
    ),
  );
}

/** Whether automatic pruning should remove an entry */
export async function isStaleIgorCacheEntry(
  entry: IgorCacheEntry,
  maxAgeDays: number,
  now: number,
): Promise<boolean> {
  // Missing or unreadable metadata: a crash, or an older format
  if (!entry.meta) return true;
  if (now - entry.meta.lastUsedAt > maxAgeDays * 24 * 60 * 60 * 1000)
    return true;
  return !(await exists(entry.meta.projectPath));
}

/**
 * Get (and create) the cache entry for a project, recording this use.
 * Wipes the entry if its last use was with a different runtime, then
 * auto-prunes other stale entries.
 */
export async function useIgorCacheEntry(
  projectPath: string,
  runtimeVersion: string,
  options?: AnyLauncherOptions,
  now = Date.now(),
): Promise<IgorCacheDirs> {
  const opts = resolveOptions(options);
  const p = opts.platform.path;
  const key = igorCacheKey(projectPath, opts);
  const directory = p.join(opts.igorCacheDir, key);
  const existing = await readEntry(directory, key);
  const dirs = {
    cache: p.join(directory, 'cache'),
    temp: p.join(directory, 'temp'),
    out: p.join(directory, 'out'),
  };
  if (existing.meta?.runtimeVersion !== runtimeVersion) {
    // A different runtime's cache is likely invalid anyway, and this keeps
    // entries from accumulating data for every runtime ever used.
    await Promise.all(
      Object.values(dirs).map((d) => rm(d, { recursive: true, force: true })),
    );
  }
  await Promise.all(
    Object.values(dirs).map((d) => mkdir(d, { recursive: true })),
  );
  const meta: IgorCacheMeta = {
    projectPath: p.resolve(projectPath),
    lastUsedAt: now,
    runtimeVersion,
  };
  await writeJsonAtomic(p.join(directory, metaFileName), meta);

  if (opts.igorCacheMaxAgeDays > 0) {
    await pruneIgorCache(
      async (entry) =>
        entry.key !== key &&
        (await isStaleIgorCacheEntry(entry, opts.igorCacheMaxAgeDays, now)),
      opts,
    ).catch((err) => opts.logger.warn('Could not prune the Igor cache', err));
  }
  return { entry: { key, directory, meta }, ...dirs };
}

/**
 * Remove Igor cache entries (all of them if no filter is given). Returns
 * the removed dirs.
 */
export async function pruneIgorCache(
  filter?: (entry: IgorCacheEntry) => boolean | Promise<boolean>,
  options?: AnyLauncherOptions,
): Promise<string[]> {
  const opts = resolveOptions(options);
  const removed: string[] = [];
  for (const entry of await listEntries(opts)) {
    if (filter && !(await filter(entry))) continue;
    await rm(entry.directory, { recursive: true, force: true });
    removed.push(entry.directory);
  }
  return removed;
}

/** List Igor cache entries with their sizes */
export async function getIgorCacheInfo(
  options?: AnyLauncherOptions,
): Promise<IgorCacheEntry[]> {
  const opts = resolveOptions(options);
  return await Promise.all(
    (await listEntries(opts)).map(async (entry) => ({
      ...entry,
      sizeBytes: await dirSize(entry.directory),
    })),
  );
}
