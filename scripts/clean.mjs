/**
 * Delete all files and folders matching the given glob patterns,
 * relative to the current working directory.
 *
 * @example
 * node ../../scripts/clean.mjs dist "*.tsbuildinfo" "**\/*.tsbuildinfo"
 */
import { glob, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * @param {string[]} patterns Glob patterns, relative to `cwd`.
 * Patterns using `**` never descend into `node_modules`.
 * @param {string} [cwd]
 * @returns {Promise<string[]>} The deleted paths.
 */
export async function removeGlobs(patterns, cwd = process.cwd()) {
  const deleted = [];
  for (const pattern of patterns) {
    const skipNodeModules = pattern.includes('**');
    for await (const match of glob(pattern, {
      cwd,
      exclude: skipNodeModules
        ? (p) => path.basename(String(p)) === 'node_modules'
        : undefined,
    })) {
      await rm(path.resolve(cwd, match), { recursive: true, force: true });
      deleted.push(match);
    }
  }
  return deleted;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const patterns = process.argv.slice(2);
  if (!patterns.length) {
    console.error('Usage: node scripts/clean.mjs <glob> [...globs]');
    process.exit(1);
  }
  await removeGlobs(patterns);
}
