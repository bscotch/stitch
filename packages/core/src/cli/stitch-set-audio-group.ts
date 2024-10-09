#!/usr/bin/env node
import { oneline, undent } from '@bscotch/utility';
import { cli, chain } from 'cli-forge';
import { addDebugOptions } from './lib/addDebugOption.js';
import { assignAudioGroups } from './lib/assign.js';
import options from './lib/cli-options.js';

export const audioGroupCommand = cli('audio-group', {
  description: undent`
  Assign all audios in a GMS IDE folder to a group.`,
  builder: (cli) =>
    chain(cli, options.targetProject, options.force, addDebugOptions)
      .option('folder', {
        type: 'string',
        description: undent`
        This is the folder name shown in the GMS IDE, not the folder name of the actual audio file.
        For example, a audio called "snd_title" is shown in the "Sounds" folder in the IDE, whereas
        the actual audio file might be at "project/sounds/snd_title/snd_title.yy".
      `,
        required: true,
      })
      .option('groupName', {
        type: 'string',
        description: oneline`
        The name of the audio group. If it does not exist, it will be created.
      `,
      }),
  handler: async (opts) => {
    await assignAudioGroups(opts);
  },
});
