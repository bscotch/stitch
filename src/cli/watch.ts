/**
 * @file General watcher utility for
 * re-running CLI commands when their
 * target files change.
 */

import { logDebug, logError, logWarning } from '@/log';
import paths from '@/paths';
import { AnyFunction, Nullish, undent } from '@bscotch/utility';
import chokidar from 'chokidar';

export function runOrWatch(
  cliOpts: { watch?: boolean | Nullish },
  ...args: Parameters<typeof onDebouncedChange>
) {
  return cliOpts.watch ? onDebouncedChange(...args) : args[0]();
}

/** Prepare and run sprite fixers, include setting up watchers if needed. */
export async function onDebouncedChange(
  onChange: AnyFunction,
  watchFolder: string,
  /**
   * E.g. 'png'
   */
  watchFileExtension: string,
  options?: {
    /**
     * Seconds to wait for additional changes before running
     * the target function. Defaults to `1` but is subject to change.
     */
    debounceWaitSeconds?: number;
  },
) {
  let debounceTimeout: NodeJS.Timeout | null = null;
  const pattern = paths
    .join(watchFolder, '**', `*.${watchFileExtension}`)
    .split(paths.sep)
    .join(paths.posix.sep);
  const watcher = chokidar.watch(pattern, {
    awaitWriteFinish: {
      stabilityThreshold: 500,
      pollInterval: 100,
    },
  });
  let running = false;
  const run = async () => {
    // Prevent overlapping runs
    if (running) {
      logDebug('Attempted to run while already running.');
      return;
    }
    running = true;
    await onChange();
    running = false;
  };
  const debouncedRun = () => {
    logDebug('Change detected, debouncing');
    clearTimeout(debounceTimeout!);
    debounceTimeout = setTimeout(run, options?.debounceWaitSeconds || 1000);
  };
  // Set up the watcher
  // Glob patterns need to have posix separators
  watcher
    .on('error', async (err: Error & { code?: string }) => {
      logWarning('Closing watcher due to error...');
      await watcher.close();
      throw err;
    })
    .on('add', debouncedRun)
    .on('change', debouncedRun)
    .on('unlink', debouncedRun)
    .on('unlinkDir', (dir) => {
      // If the root directory gets unlinked, close the watcher.
      if (paths.resolve(dir) == paths.resolve(watchFolder)) {
        logError(
          undent`
            Watched root directory deleted: "${watchFolder}"
            Requires manual restart once the directory exists again.`,
        );
        process.exit(1);
      }
    });
  await run();
}
