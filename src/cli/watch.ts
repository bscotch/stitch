/**
 * @file General watcher utility for
 * re-running CLI commands when their
 * target files change.
 */

import { debug, error, info, warning } from '@/log';
import { Nullish } from '@bscotch/utility';
import { debounceWatch, DebounceWatchOptions } from '@bscotch/debounce-watch';

process.on('unhandledRejection', (err) => {
  console.log(err);
  process.exit(1);
});

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
        logger: { debug, error, info, warn: warning },
      })
    : runner();
}
