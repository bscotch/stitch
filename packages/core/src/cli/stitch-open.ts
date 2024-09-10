#!/usr/bin/env node

import { GameMakerLauncher } from '@bscotch/stitch-launcher';
import { ok } from 'assert';
import debug from 'debug';
import { StitchProjectStatic } from '../lib/StitchProject.static.js';
import { loadProjectFromArgs } from './lib/params.js';
import { cli } from 'cli-forge';

export const openCommand = cli('open', {
  description:
    'Open a GameMaker project with a specific IDE and Runtime version.',
  builder: (cli) =>
    cli
      .option('project', {
        description: 'The path to the GameMaker Studio 2 project to open.',
        default: {
          value: process.cwd(),
          description: 'Current directory',
        },
        type: 'string',
      })
      .option('ide', {
        description:
          'The IDE version to use. Defaults to the last one used to open the project.',
        type: 'string',
      })
      .option('runtime', {
        description: 'The runtime version to use.',
        type: 'string',
      })
      .option('programFiles', {
        description:
          'If you have installed GameMaker to somewhere besides the default C:\\Program Files\\ directory, specify that directory here.',
        type: 'string',
      })
      .option('debug', {
        description: 'Enable debug logging.',
        type: 'boolean',
      }),
  handler: async (args) => {
    // Get the target project
    const targetProjectPaths =
      await StitchProjectStatic.listYypFilesRecursively(args.project);

    ok(
      targetProjectPaths.length > 0,
      `No GameMaker projects found in ${args.project}`,
    );
    ok(
      targetProjectPaths.length === 1,
      `Multiple GameMaker projects found in ${args.project}. Provide a specific project path with the --project option.`,
    );

    if (args.debug) {
      debug.enable('@bscotch/stitch-launcher:*');
    }

    await GameMakerLauncher.openProject(targetProjectPaths[0], {
      ideVersion:
        args.ide ||
        (
          await loadProjectFromArgs({
            targetProject: targetProjectPaths[0],
            readOnly: true,
            force: true,
          })
        ).ideVersion,
      runtimeVersion: args.runtime,
      programFiles: args.programFiles,
    });
  },
});
