#!/usr/bin/env node
import { oneline, undent } from '@bscotch/utility';
import { program as cli } from 'commander';
import { StitchProject } from '../lib/StitchProject.js';
import { ImportBaseOptions } from './lib/add-base-options.js';
import importSounds from './lib/add-sounds.js';
import { addDebugOptions } from './lib/addDebugOption.js';
import options from './lib/cli-options.js';
import { runOrWatch } from './watch.js';

cli
  .description(
    undent`
    Create/update sound assets from a file or a path.
    If the asset does not already exists in the target project, it will be placed in the "NEW" folder.
    Otherwise, the asset will be replaced by the source asset.`,
  )
  .requiredOption(
    '--source <path>',
    oneline`
    Path to the sound file or the folder containing the sounds files.
  `,
  )
  .option(
    '--extensions <extensions...>',
    oneline`
    input one or more of the supported extensions: mp3, wav, ogg, wma. 
    If not set, Will attempt to import all supported extensions.
  `,
  )
  .option(...options.targetProject)
  .option(...options.force)
  .option(...options.watch);
addDebugOptions(cli).parse(process.argv);

const opts = cli.opts() as ImportBaseOptions & { extensions?: string };
runOrWatch(
  opts,
  () => importSounds(opts),
  opts.source,
  opts.extensions
    ? opts.extensions.split(',')
    : StitchProject.supportedSoundFileExtensions,
);
