#!/usr/bin/env node
import { oneline, undent } from '@bscotch/utility';
import { StitchProject } from '../lib/StitchProject.js';
import importSounds from './lib/add-sounds.js';
import { addDebugOptions } from './lib/addDebugOption.js';
import * as options from './lib/cli-options.js';
import { runOrWatch } from './watch.js';
import { cli, chain } from 'cli-forge';

export const addSoundsCommand = cli('sounds', {
  description: undent`
    Create/update sound assets from a file or a path.
    If the asset does not already exists in the target project, it will be placed in the "NEW" folder.
    Otherwise, the asset will be replaced by the source asset.`,
  builder: (argv) =>
    chain(
      argv,
      addDebugOptions,
      options.force,
      options.targetProject,
      options.watch,
    )
      .option('source', {
        type: 'string',
        required: true,
        description: oneline`
        Path to the sound file or the folder containing the sounds files.
      `,
      })
      .option('extensions', {
        type: 'array',
        items: 'string',
        description: oneline`
        input one or more of the supported extensions: mp3, wav, ogg, wma. 
        If not set, Will attempt to import all supported extensions.
      `,
      }),
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  handler: (argv) => {
    runOrWatch(
      argv,
      () => importSounds(argv),
      argv.source,
      argv.extensions
        ? argv.extensions
        : StitchProject.supportedSoundFileExtensions,
    );
  },
});
