/**
 * @file General watcher utility for
 * re-running CLI commands when their
 * target files change.
 */

import { debug, error, info, warning } from '@/log';
import paths from '@/paths';
import { AnyFunction, Nullish, undent, wrapIfNotArray } from '@bscotch/utility';
import chokidar from 'chokidar';
import type { Stats } from 'fs';

process.on('unhandledRejection', (err) => {
  console.log(err);
  process.exit(1);
});

export function runOrWatch(
  cliOpts: { watch?: boolean | Nullish },
  ...args: Parameters<typeof onDebouncedChange>
) {
  return cliOpts.watch ? onDebouncedChange(...args) : args[0]();
}

/** Prepare and run sprite fixers, include setting up watchers if needed. */
export function onDebouncedChange(
  onChange: AnyFunction,
  watchFolder: string,
  /**
   * E.g. 'png'
   */
  watchFileExtension: string | string[] | Nullish,
  options?: {
    /**
     * Seconds to wait for additional changes before running
     * the target function. Defaults to `1` but is subject to change.
     */
    debounceWaitSeconds?: number;
  },
) {
  info(`Running in watch mode from "${process.cwd()}"`);
  const extensions = wrapIfNotArray(watchFileExtension || null); // 'undefined' results in an empty array
  debug(`Watching folder "${watchFolder}"`);
  const debounceWaitMillis = (options?.debounceWaitSeconds || 1) * 1000;
  let debounceTimeout: NodeJS.Timeout | null = null;
  const watcher = chokidar.watch(watchFolder, {
    // polling seems to be a lot more reliable (if also a lot less efficient)
    usePolling: true,
    interval: debounceWaitMillis,
    binaryInterval: debounceWaitMillis,
    disableGlobbing: true,
    ignored: (path: string, stat: Stats) => {
      if (stat) {
        if (stat.isDirectory()) {
          return false;
        }
        const matchesExtension =
          !extensions[0] || extensions.some((ext) => path.endsWith(`.${ext}`));
        return !matchesExtension;
      }
      return false;
    },
    awaitWriteFinish: {
      stabilityThreshold: debounceWaitMillis / 2,
      pollInterval: debounceWaitMillis / 5,
    },
  });
  let running = false;
  const run = async () => {
    // Prevent overlapping runs
    if (running) {
      debug('Attempted to run while already running.');
      return;
    }
    info('Running watcher command...');
    running = true;
    await onChange();
    running = false;
  };
  const debouncedRun = () => {
    debug('Change detected, debouncing');
    clearTimeout(debounceTimeout!);
    debounceTimeout = setTimeout(run, debounceWaitMillis);
  };
  // Set up the watcher
  // Glob patterns need to have posix separators
  watcher
    .on('error', async (err: Error & { code?: string }) => {
      warning('Closing watcher due to error...');
      await watcher.close();
      throw err;
    })
    .on('add', (f) => {
      debug(`Detected added file "${f}"`);
      debouncedRun();
    })
    .on('change', (f) => {
      debug(`Detected changed file "${f}"`);
      debouncedRun();
    })
    .on('unlink', (f) => {
      debug(`Detected deleted file "${f}"`);
      debouncedRun();
    })
    .on('unlinkDir', (dir) => {
      // If the root directory gets unlinked, close the watcher.
      if (paths.resolve(dir) == paths.resolve(watchFolder)) {
        error(
          undent`
            Watched root directory deleted: "${watchFolder}"
            Requires manual restart once the directory exists again.`,
        );
        process.exit(1);
      }
    });
  // Don't need to call the function right out of the gate,
  // because the watcher triggers 'add' events when it loads.
}
