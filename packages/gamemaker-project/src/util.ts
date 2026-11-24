import { createHash } from 'node:crypto';
import { constants } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';

export class GameMakerProjectError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'GameMakerProjectError';
  }
}

export function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new GameMakerProjectError(message);
}

const identifierPattern = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

export function isValidIdentifier(name: string): boolean {
  return identifierPattern.test(name);
}

export function assertIsValidIdentifier(name: string): void {
  assert(
    isValidIdentifier(name),
    `"${name}" is not a valid GameMaker identifier`,
  );
}

/**
 * Normalize an asset-folder path, given either in POSIX form (`my/folder`) or
 * in the form used in yy files (`folders/my/folder.yy`), to POSIX form.
 */
export function folderPathToPosix(folderPath: string): string {
  return folderPath
    .replace(/[\\/]+/g, '/')
    .replace(/^\//, '')
    .replace(/\/$/, '')
    .replace(/^folders\/(.*)\.yy$/, '$1');
}

/** Convert a POSIX-style folder path to the yy form: `folders/my/folder.yy` */
export function folderPathToYy(folderPath: string): string {
  return `folders/${folderPathToPosix(folderPath)}.yy`;
}

/** Split a folder or asset path (POSIX or Windows separators) into parts. */
export function splitPath(p: string | string[]): string[] {
  return (Array.isArray(p) ? p : p.split(/[/\\]+/)).filter(Boolean);
}

export function toPosix(p: string): string {
  return p.replace(/\\/g, '/');
}

/** Lowercased key used for case-insensitive lookups */
export function key(name: string): string {
  return name.toLowerCase();
}

export async function exists(p: string): Promise<boolean> {
  try {
    await fs.access(p, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

export async function isDirectory(p: string): Promise<boolean> {
  try {
    return (await fs.stat(p)).isDirectory();
  } catch {
    return false;
  }
}

/** List the names of a directory's entries, or `[]` if it doesn't exist */
export async function listDir(dir: string): Promise<string[]> {
  try {
    return await fs.readdir(dir);
  } catch {
    return [];
  }
}

/** Recursively list all files (not directories) under a directory */
export async function listFilesRecursively(dir: string): Promise<string[]> {
  const files: string[] = [];
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true, recursive: true });
  } catch {
    return files;
  }
  for (const entry of entries) {
    if (entry.isFile()) files.push(path.join(entry.parentPath, entry.name));
  }
  return files.sort();
}

/**
 * Find the entry in `dir` whose name matches `name` case-insensitively,
 * preferring an exact match. */
export async function findCaseInsensitive(
  dir: string,
  name: string,
): Promise<string | undefined> {
  const entries = await listDir(dir);
  const match =
    entries.find((e) => e === name) ||
    entries.find((e) => key(e) === key(name));
  return match && path.join(dir, match);
}

export function hash(content: string | Buffer): string {
  return createHash('sha1').update(content).digest('hex');
}

/**
 * Read just enough of a PNG file to get its dimensions,
 * throwing if it isn't a PNG.
 */
export async function getPngSize(
  file: string,
): Promise<{ width: number; height: number }> {
  const fd = await fs.open(file, 'r');
  try {
    const buf = Buffer.alloc(24);
    await fd.read(buf, 0, 24, 0);
    assert(
      buf.toString('latin1', 1, 4) === 'PNG',
      `Expected a PNG file: ${file}`,
    );
    const size = { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
    assert(size.width > 0 && size.height > 0, `Invalid PNG size: ${file}`);
    return size;
  } finally {
    await fd.close();
  }
}

/** Run `fn` over `items` with at most `limit` running at once. */
export async function mapConcurrent<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from(
    { length: Math.min(limit, items.length) },
    async () => {
      while (next < items.length) {
        const i = next++;
        results[i] = await fn(items[i]);
      }
    },
  );
  await Promise.all(workers);
  return results;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Runs async tasks one at a time, in the order they were queued.
 * A failing task does not prevent later tasks from running.
 */
export class SerialQueue {
  protected tail: Promise<unknown> = Promise.resolve();
  protected pending = 0;

  run<T>(task: () => Promise<T>): Promise<T> {
    this.pending++;
    const result = this.tail.then(task);
    this.tail = result
      .catch(() => undefined)
      .finally(() => {
        this.pending--;
      });
    return result;
  }

  /** `true` if a task is running or waiting to run */
  get busy(): boolean {
    return this.pending > 0;
  }

  /** Resolves once every task queued so far has settled */
  async idle(): Promise<void> {
    while (this.pending) await this.tail;
  }
}
