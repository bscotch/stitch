#!/usr/bin/env node
import { oneline, undent } from '@bscotch/utility';
import { cli, chain } from 'cli-forge';
import importFiles from './lib/add-files.js';
import { addDebugOptions } from './lib/addDebugOption.js';
import * as options from './lib/cli-options.js';
import { runOrWatch } from './watch.js';

export const addFilesCommand = cli('files', {
  description: undent`
  Create/update included file assets from a file or a path.
  If the asset does not already exists in the target project, it will be placed in the "NEW" folder.
  Otherwise, the asset will be replaced by the source asset.`,

  builder: (argv) =>
    chain(argv, options.force, options.targetProject, addDebugOptions)
      .option('extensions', {
        type: 'array',
        items: 'string',
        description: oneline`
        Only allow certain extensions to be imported. 
        If not set, Will attempt to import all files.
      `,
      })
      .option('source', {
        type: 'string',
        description: oneline`
        Path to the file or the folder containing the files to import.
      `,
      }),
  handler: (argv) => {
    runOrWatch(
      // argv doesn't have watch, so we are casting it here... I don't love that,
      // but I think adding watch wouldn't make sense here either.
      argv as { watch?: boolean },
      () => importFiles(argv),
      argv.source,
      argv.extensions,
    );
  },
});
