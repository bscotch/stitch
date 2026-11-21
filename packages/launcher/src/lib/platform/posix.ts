/**
 * @file Helpers shared by the macOS and Linux platform layers.
 */
import { readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { execFile } from '../exec.ts';
import type { RunningProcess } from './types.ts';

const p = path.posix;

/** Run `7zz x` on an archive into `outDir` */
export async function sevenZipExtract(
  sevenZip: string,
  archive: string,
  outDir: string,
  type?: string,
) {
  const args = ['x', '-y', '-bd', `-o${outDir}`];
  if (type) args.push(`-t${type}`);
  // Keep symlinks as symlinks (macOS frameworks and Linux libs use them)
  // TODO(verify): `-snl` behavior when extracting cpio and tar payloads.
  args.push('-snl', archive);
  const result = await execFile(sevenZip, args, { timeoutMs: 15 * 60_000 });
  if (result.code !== 0) {
    throw new Error(
      `7-Zip exited with code ${result.code} extracting "${archive}": ${result.stderr || result.stdout}`,
    );
  }
}

/**
 * Some archives contain a single compressed archive (e.g. `data.tar.xz`
 * contains `data.tar`, and a pkg `Payload` contains a cpio stream). Keep
 * extracting while the result is a single file, up to `maxDepth` times.
 * Returns the final dir.
 */
export async function extractNested(
  sevenZip: string,
  archive: string,
  workDir: string,
  maxDepth = 3,
): Promise<string> {
  let current = archive;
  for (let depth = 0; depth < maxDepth; depth++) {
    const outDir = p.join(workDir, `level-${depth}`);
    await sevenZipExtract(sevenZip, current, outDir);
    const entries = await readdir(outDir);
    if (entries.length === 1) {
      const only = p.join(outDir, entries[0]);
      if ((await stat(only)).isFile()) {
        current = only;
        continue;
      }
    }
    return outDir;
  }
  throw new Error(`"${archive}" is nested more than ${maxDepth} levels deep`);
}

/** Recursively find entries matching a predicate, up to a depth */
export async function findEntries(
  dir: string,
  predicate: (name: string, isDir: boolean) => boolean,
  maxDepth: number,
): Promise<string[]> {
  const found: string[] = [];
  const walk = async (current: string, depth: number) => {
    let entries;
    try {
      entries = await readdir(current, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = p.join(current, entry.name);
      if (predicate(entry.name, entry.isDirectory())) {
        found.push(full);
      } else if (entry.isDirectory() && depth < maxDepth) {
        await walk(full, depth + 1);
      }
    }
  };
  await walk(dir, 0);
  return found;
}

/** Parse `ps -axo pid=,comm=` output */
export function parsePsOutput(output: string): RunningProcess[] {
  const processes: RunningProcess[] = [];
  for (const line of output.split('\n')) {
    const match = line.match(/^\s*(\d+)\s+(.+?)\s*$/);
    if (match) {
      processes.push({ pid: Number(match[1]), executable: match[2] });
    }
  }
  return processes;
}

export function killPosixProcess(pid: number): Promise<void> {
  try {
    process.kill(pid, 'SIGTERM');
  } catch {
    // Already gone
  }
  return Promise.resolve();
}

/** Find an executable on a PATH-like string */
export function splitPath(pathVar: string | undefined, delimiter: string) {
  return (pathVar || '').split(delimiter).filter(Boolean);
}
