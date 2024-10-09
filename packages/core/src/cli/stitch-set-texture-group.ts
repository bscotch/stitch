#!/usr/bin/env node
import { oneline, undent } from '@bscotch/utility';
import { cli, chain } from 'cli-forge';
import { addDebugOptions } from './lib/addDebugOption.js';
import { assignTextureGroups } from './lib/assign.js';
import options from './lib/cli-options.js';

export const textureGroupCommand = cli('texture-group', {
  description: undent`
  Assign all sprites in a GMS IDE folder to a group.`,
  builder: (cli) =>
    chain(cli, options.targetProject, options.force, addDebugOptions)
      .option('folder', {
        type: 'string',
        required: true,
        description: undent`
        This is the folder name shown in the GMS IDE, not the folder name of the actual sprite file.
        For example, a sprite called "sp_title" is shown in the "Sprites" folder in the IDE, whereas
        the actual sprite file might be at "project/sprites/sp_title/sp_title.yy".
      `,
      })
      .option('groupName', {
        type: 'string',
        description: oneline`
        The name of the texture group. If it does not exist, it will be created.
      `,
      }),
  handler: async (opts) => {
    await assignTextureGroups(opts);
  },
});
