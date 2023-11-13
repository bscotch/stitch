import { Pathy } from '@bscotch/pathy';
import type { Dirent } from 'node:fs';
import fsp from 'node:fs/promises';
import { FIO_RETRY_DELAY, MAX_FIO_RETRIES } from './constants.js';
import { SpriteSourceError } from './utility.js';

/**
 * A wrapper around `fs.readdir` that retries a few times and
 * uses the `withFileTypes` option.
 */
async function _readdirSafe<T extends boolean>(
  dir: string | Pathy,
  withFileTypes?: T,
): Promise<T extends true ? Dirent[] : string[]> {
  let retries = 0;
  let files: any[] = [];
  let error: SpriteSourceError | null = null;
  while (retries < MAX_FIO_RETRIES) {
    error = null;
    try {
      // @ts-expect-error withFileTypes can only be `true` in the types
      files = await fsp.readdir(dir.toString(), { withFileTypes });
      return files;
    } catch (err) {
      error = new SpriteSourceError(`Failed to read directory ${dir}`, err);
      retries++;
      await new Promise((resolve) => setTimeout(resolve, FIO_RETRY_DELAY));
      continue;
    }
  }
  throw error;
}

export async function readdirSafe(dir: string | Pathy): Promise<string[]> {
  return await _readdirSafe(dir, false);
}

export async function readdirSafeWithFileTypes(
  dir: string | Pathy,
): Promise<Dirent[]> {
  return await _readdirSafe(dir, true);
}
