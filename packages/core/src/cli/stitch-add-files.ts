#!/usr/bin/env node
import { oneline, undent } from '@bscotch/utility';
import { program as cli } from 'commander';
import { ImportBaseOptions } from './lib/add-base-options.js';
import importFiles from './lib/add-files.js';
import { addDebugOptions } from './lib/addDebugOption.js';
import options from './lib/cli-options.js';
import { runOrWatch } from './watch.js';

cli
  .description(
    undent`
  Create/update included file assets from a file or a path.
  If the asset does not already exists in the target project, it will be placed in the "NEW" folder.
  Otherwise, the asset will be replaced by the source asset.`,
  )
  .requiredOption(
    '--source <path>',
    oneline`
    Path to the file or the folder containing the files to import.
  `,
  )
  .option(
    '--extensions <extensions...>',
    oneline`
    Only allow certain extensions to be imported. 
    If not set, Will attempt to import all files.
  `,
  )
  .option(...options.targetProject)
  .option(...options.force);
addDebugOptions(cli).parse(process.argv);

const opts = cli.opts() as ImportBaseOptions & { extensions?: string };
runOrWatch(opts, () => importFiles(opts), opts.source, opts.extensions);
