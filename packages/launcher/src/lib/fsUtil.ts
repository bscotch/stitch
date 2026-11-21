import {
  access,
  mkdir,
  readdir,
  readFile,
  rename,
  stat,
  writeFile,
} from 'node:fs/promises';
import path from 'node:path';

export async function exists(target: string): Promise<boolean> {
  try {
    await access(target);
    return true;
  } catch {
    return false;
  }
}

/** Write JSON via a temp file and a rename, so readers never see partial files */
export async function writeJsonAtomic(file: string, data: unknown) {
  await mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.${Math.random().toString(36).slice(2)}.tmp`;
  await writeFile(tmp, JSON.stringify(data, null, 2));
  await rename(tmp, file);
}

/** Read and parse a JSON file, or return `undefined` if missing or invalid */
export async function readJson<T = unknown>(
  file: string,
): Promise<T | undefined> {
  try {
    return JSON.parse(stripBom(await readFile(file, 'utf8'))) as T;
  } catch {
    return;
  }
}

export function stripBom(text: string) {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

/** Total size of all files in a dir, recursively (symlinks not followed) */
export async function dirSize(dir: string): Promise<number> {
  let total = 0;
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return 0;
  }
  await Promise.all(
    entries.map(async (entry) => {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        total += await dirSize(full);
      } else if (entry.isFile()) {
        total += (await stat(full).catch(() => ({ size: 0 }))).size;
      }
    }),
  );
  return total;
}
