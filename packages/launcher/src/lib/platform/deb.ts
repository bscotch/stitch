/**
 * @file Unpack Debian packages (`.deb`) with nothing but Node, so Linux
 * users don't need any extra tools. A deb is an `ar` archive containing a
 * `data.tar.*`, which holds the files to install. GameMaker's debs use
 * zstd compression (`data.tar.zst`), which needs Node 22.15 or newer.
 */
import { createReadStream } from 'node:fs';
import {
  chmod,
  link,
  mkdir,
  open,
  rm,
  symlink,
  type FileHandle,
} from 'node:fs/promises';
import path from 'node:path';
import type { Transform } from 'node:stream';
import zlib from 'node:zlib';

const posix = path.posix;

export interface ArEntry {
  name: string;
  /** Byte offset of the entry's data in the archive */
  offset: number;
  size: number;
}

/** List the entries of an `ar` archive (the container format of debs) */
export async function listArEntries(file: string): Promise<ArEntry[]> {
  const handle = await open(file);
  try {
    const magic = Buffer.alloc(8);
    await handle.read(magic, 0, 8, 0);
    if (magic.toString('latin1') !== '!<arch>\n') {
      throw new Error(`"${file}" is not an ar archive`);
    }
    const { size: fileSize } = await handle.stat();
    const entries: ArEntry[] = [];
    const header = Buffer.alloc(60);
    let offset = 8;
    while (offset + 60 <= fileSize) {
      await handle.read(header, 0, 60, offset);
      if (header.toString('latin1', 58, 60) !== '`\n') {
        throw new Error(`Corrupt ar header at byte ${offset} of "${file}"`);
      }
      // GNU ar terminates names with "/"
      const name = header.toString('latin1', 0, 16).trim().replace(/\/$/, '');
      const size = Number(header.toString('latin1', 48, 58).trim());
      if (!Number.isSafeInteger(size) || size < 0) {
        throw new Error(`Corrupt ar entry size at byte ${offset} of "${file}"`);
      }
      entries.push({ name, offset: offset + 60, size });
      // Entry data is padded to an even length
      offset += 60 + size + (size % 2);
    }
    return entries;
  } finally {
    await handle.close();
  }
}

function decompressorFor(name: string): Transform | undefined {
  if (name.endsWith('.tar')) return;
  if (name.endsWith('.zst')) {
    if (typeof zlib.createZstdDecompress !== 'function') {
      throw new Error(
        `Unpacking "${name}" needs zstd support, which Node ${process.version} lacks (it needs Node 22.15 or newer).`,
      );
    }
    return zlib.createZstdDecompress();
  }
  if (name.endsWith('.gz')) return zlib.createGunzip();
  throw new Error(`Unsupported deb data compression: "${name}"`);
}

/** Reads exact byte counts from a stream of chunks */
class ChunkReader {
  readonly #chunks: AsyncIterator<Buffer>;
  #buffer: Buffer = Buffer.alloc(0);
  #ended = false;

  constructor(source: AsyncIterable<Buffer>) {
    this.#chunks = source[Symbol.asyncIterator]();
  }

  async #fill(): Promise<boolean> {
    if (this.#ended) return false;
    const next = await this.#chunks.next();
    if (next.done) {
      this.#ended = true;
      return false;
    }
    this.#buffer = this.#buffer.length
      ? Buffer.concat([this.#buffer, next.value])
      : next.value;
    return true;
  }

  /** The next `n` bytes, or `undefined` if the stream ended cleanly first */
  async read(n: number): Promise<Buffer | undefined> {
    while (this.#buffer.length < n) {
      if (!(await this.#fill())) {
        if (!this.#buffer.length) return;
        throw new Error('Unexpected end of archive');
      }
    }
    const out = this.#buffer.subarray(0, n);
    this.#buffer = this.#buffer.subarray(n);
    return out;
  }

  /** Pass the next `n` bytes to `onChunk`, piece by piece */
  async consume(n: number, onChunk?: (chunk: Buffer) => Promise<unknown>) {
    while (n > 0) {
      if (!this.#buffer.length && !(await this.#fill())) {
        throw new Error('Unexpected end of archive');
      }
      const take = Math.min(n, this.#buffer.length);
      const piece = this.#buffer.subarray(0, take);
      this.#buffer = this.#buffer.subarray(take);
      n -= take;
      await onChunk?.(piece);
    }
  }
}

function cString(buf: Buffer, start: number, end: number) {
  const nul = buf.indexOf(0, start);
  return buf.toString('utf8', start, nul >= start && nul < end ? nul : end);
}

function tarNumber(buf: Buffer, start: number, end: number): number {
  // GNU base-256 encoding, for values too big for the octal field
  if (buf[start] & 0x80) {
    let value = buf[start] & 0x7f;
    for (let i = start + 1; i < end; i++) value = value * 256 + buf[i];
    return value;
  }
  const text = cString(buf, start, end).trim();
  return text ? parseInt(text, 8) : 0;
}

function parsePax(data: Buffer): Record<string, string> {
  const records: Record<string, string> = {};
  let i = 0;
  while (i < data.length) {
    const space = data.indexOf(0x20, i);
    if (space < 0) break;
    const length = Number(data.toString('utf8', i, space));
    if (!length) break;
    const record = data.toString('utf8', space + 1, i + length - 1);
    const eq = record.indexOf('=');
    if (eq > 0) records[record.slice(0, eq)] = record.slice(eq + 1);
    i += length;
  }
  return records;
}

export type TarEntryType = 'file' | 'directory' | 'symlink' | 'hardlink';

export interface TarEntry {
  /** The path within the archive, without any leading `./` */
  path: string;
  type: TarEntryType;
  mode: number;
  size: number;
  linkTarget?: string;
}

function normalizeArchivePath(name: string) {
  return name.replace(/^(\.\/)+/, '').replace(/^\/+/, '');
}

/**
 * Read a tar stream, calling `onEntry` for each entry. File data is passed
 * to the handler returned by `onEntry` (if any) in chunks.
 */
export async function readTar(
  source: AsyncIterable<Buffer>,
  onEntry: (
    entry: TarEntry,
  ) => Promise<((chunk: Buffer) => Promise<unknown>) | void>,
  onFileEnd?: () => Promise<void>,
) {
  const reader = new ChunkReader(source);
  let pax: Record<string, string> = {};
  let longName: string | undefined;
  let longLink: string | undefined;
  while (true) {
    const header = await reader.read(512);
    if (!header || header.every((b) => b === 0)) break;
    const size = tarNumber(header, 124, 136);
    const padded = Math.ceil(size / 512) * 512;
    const typeFlag = String.fromCharCode(header[156] || 0x30);

    // Metadata entries that describe the next entry
    if (typeFlag === 'x' || typeFlag === 'L' || typeFlag === 'K') {
      const data = (await reader.read(padded))!.subarray(0, size);
      if (typeFlag === 'x') pax = { ...pax, ...parsePax(data) };
      else if (typeFlag === 'L') longName = cString(data, 0, data.length);
      else longLink = cString(data, 0, data.length);
      continue;
    }
    if (typeFlag === 'g') {
      await reader.consume(padded);
      continue;
    }

    const isUstar = header.toString('latin1', 257, 262) === 'ustar';
    const prefix = isUstar ? cString(header, 345, 500) : '';
    const rawName = cString(header, 0, 100);
    const name =
      pax.path ?? longName ?? (prefix ? `${prefix}/${rawName}` : rawName);
    const linkTarget =
      pax.linkpath ?? longLink ?? (cString(header, 157, 257) || undefined);
    const realSize = pax.size ? Number(pax.size) : size;
    pax = {};
    longName = longLink = undefined;

    const type: TarEntryType | undefined =
      typeFlag === '0' || typeFlag === '7'
        ? 'file'
        : typeFlag === '5'
          ? 'directory'
          : typeFlag === '2'
            ? 'symlink'
            : typeFlag === '1'
              ? 'hardlink'
              : undefined;
    const dataSize = Math.ceil(realSize / 512) * 512;
    if (!type) {
      // Devices, FIFOs etc. have no place in an IDE install
      await reader.consume(dataSize);
      continue;
    }
    const entry: TarEntry = {
      path: normalizeArchivePath(name),
      type,
      mode: tarNumber(header, 100, 108) & 0o7777,
      size: type === 'file' ? realSize : 0,
      linkTarget: linkTarget && normalizeArchivePath(linkTarget),
    };
    if (type === 'symlink') entry.linkTarget = linkTarget;
    const onData = await onEntry(entry);
    if (type === 'file') {
      await reader.consume(realSize, onData || undefined);
      await reader.consume(dataSize - realSize);
      if (onData) await onFileEnd?.();
    } else {
      await reader.consume(dataSize);
    }
  }
}

/**
 * Where an archive path should go, relative to the destination dir, or
 * `undefined` to skip it.
 */
export type ArchivePathMapper = (archivePath: string) => string | undefined;

export interface UnpackStats {
  files: number;
  directories: number;
  links: number;
}

/** Resolve a relative destination path, refusing anything that escapes */
function safeJoin(destDir: string, relative: string) {
  const normalized = posix.normalize(relative);
  if (
    !normalized ||
    normalized === '.' ||
    posix.isAbsolute(normalized) ||
    normalized === '..' ||
    normalized.startsWith('../')
  ) {
    throw new Error(`Refusing to unpack an unsafe path: "${relative}"`);
  }
  return path.join(destDir, ...normalized.split('/'));
}

/**
 * Unpack a deb's `data.tar.*` into `destDir`, keeping file modes and
 * symlinks. `mapPath` chooses which entries to unpack and where.
 */
export async function unpackDeb(
  deb: string,
  destDir: string,
  mapPath: ArchivePathMapper = (p) => p,
): Promise<UnpackStats> {
  const data = (await listArEntries(deb)).find((e) =>
    e.name.startsWith('data.tar'),
  );
  if (!data) throw new Error(`No data.tar found in "${deb}"`);
  const decompressor = decompressorFor(data.name);
  const raw = createReadStream(deb, {
    start: data.offset,
    end: data.offset + data.size - 1,
  });
  const stream: AsyncIterable<Buffer> = decompressor
    ? raw.pipe(decompressor)
    : raw;
  raw.on('error', (err) => decompressor?.destroy(err));

  const stats: UnpackStats = { files: 0, directories: 0, links: 0 };
  const madeDirs = new Set<string>();
  const ensureDir = async (dir: string) => {
    if (madeDirs.has(dir)) return;
    await mkdir(dir, { recursive: true });
    madeDirs.add(dir);
  };
  let current: { handle: FileHandle; target: string; mode: number } | undefined;

  try {
    await readTar(
      stream,
      async (entry) => {
        const relative = entry.path && mapPath(entry.path);
        if (!relative) return;
        const target = safeJoin(destDir, relative);
        switch (entry.type) {
          case 'directory':
            await ensureDir(target);
            await chmod(target, entry.mode || 0o755);
            stats.directories++;
            return;
          case 'file': {
            await ensureDir(path.dirname(target));
            const handle = await open(target, 'w', entry.mode || 0o644);
            current = { handle, target, mode: entry.mode || 0o644 };
            stats.files++;
            return (chunk) => handle.write(chunk);
          }
          case 'symlink': {
            const linkTarget = entry.linkTarget!;
            // Only relative links that stay inside the unpacked tree
            const resolved = posix.normalize(
              posix.join(posix.dirname(relative), linkTarget),
            );
            if (posix.isAbsolute(linkTarget) || resolved.startsWith('..')) {
              throw new Error(
                `Refusing to unpack a symlink that points outside the package: "${entry.path}" -> "${linkTarget}"`,
              );
            }
            await ensureDir(path.dirname(target));
            await rm(target, { force: true });
            await symlink(linkTarget, target);
            stats.links++;
            return;
          }
          case 'hardlink': {
            const source = entry.linkTarget && mapPath(entry.linkTarget);
            if (!source) {
              throw new Error(
                `Hard link "${entry.path}" points at an entry that was not unpacked`,
              );
            }
            await ensureDir(path.dirname(target));
            await rm(target, { force: true });
            await link(safeJoin(destDir, source), target);
            stats.links++;
            return;
          }
        }
      },
      async () => {
        if (!current) return;
        const { handle, target, mode } = current;
        current = undefined;
        await handle.close();
        // The umask may have stripped bits from the mode given to open()
        await chmod(target, mode);
      },
    );
  } finally {
    await current?.handle.close().catch(() => undefined);
    raw.destroy();
  }
  return stats;
}
