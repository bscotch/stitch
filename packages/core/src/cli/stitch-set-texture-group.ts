#!/usr/bin/env node
import { oneline, undent } from '@bscotch/utility';
import { program as cli } from 'commander';
import { addDebugOptions } from './lib/addDebugOption.js';
import { AssignCliOptions, assignTextureGroups } from './lib/assign.js';
import options from './lib/cli-options.js';

cli
  .description(
    undent`
  Assign all sprites in a GMS IDE folder to a group.`,
  )
  .requiredOption(
    '--folder <folder>',
    undent`
    This is the folder name shown in the GMS IDE, not the folder name of the actual sprite file.
    For example, a sprite called "sp_title" is shown in the "Sprites" folder in the IDE, whereas
    the actual sprite file might be at "project/sprites/sp_title/sp_title.yy".
  `,
  )
  .requiredOption(
    '--group-name <name>',
    oneline`
    The name of the texture group. If it does not exist, it will be created.
  `,
  )
  .option(...options.targetProject)
  .option(...options.force);
addDebugOptions(cli).parse(process.argv);

await assignTextureGroups(cli.opts() as AssignCliOptions);
