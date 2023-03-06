/**
 * @file General watcher utility for
 * re-running CLI commands when their
 * target files change.
 */

import { debounceWatch, DebounceWatchOptions } from '@bscotch/debounce-watch';
import type { Nullish } from '@bscotch/utility';
import { debug, error, info, warn } from '../utility/log.js';

export function runOrWatch(
  cliOpts: { watch?: boolean | Nullish },
  runner: () => any | Promise<any>,
  watchFolder: string,
  extensions?: string | string[],
  options?: Omit<DebounceWatchOptions, 'onlyFileExtensions'>,
) {
  return cliOpts.watch
    ? debounceWatch(runner, watchFolder, {
        ...options,
        onlyFileExtensions: extensions,
        logger: { debug, error, info, warn: warn },
      })
    : runner();
}
