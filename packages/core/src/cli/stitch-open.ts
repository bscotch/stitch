#!/usr/bin/env node

import { GameMakerLauncher } from '@bscotch/stitch-launcher';
import { ok } from 'assert';
import debug from 'debug';
import { ArgumentConfig, parse as parseArgs } from 'ts-command-line-args';
import { StitchProjectStatic } from '../lib/StitchProject.static.js';
import { loadProjectFromArgs } from './lib/params.js';

const argsConfig: ArgumentConfig<{
  project: string;
  ide?: string;
  runtime?: string;
  programFiles?: string;
  help?: boolean;
  debug?: boolean;
}> = {
  project: {
    description: 'The path to the GameMaker Studio 2 project to open.',
    group: 'Open',
    defaultValue: process.cwd(),
    defaultOption: true,
    type: String,
  },
  ide: {
    description:
      'The IDE version to use. Defaults to the last one used to open the project.',
    group: 'Open',
    optional: true,
    type: String,
  },
  runtime: {
    description: 'The runtime version to use.',
    group: 'Open',
    type: String,
    optional: true,
  },
  programFiles: {
    description:
      'If you have installed GameMaker to somewhere besides the default C:\\Program Files\\ directory, specify that directory here.',
    group: 'Open',
    type: String,
    optional: true,
  },
  debug: {
    description: 'Enable debug logging.',
    group: 'Open',
    type: Boolean,
    optional: true,
  },
  help: {
    description: 'Show help.',
    alias: 'h',
    optional: true,
    type: Boolean,
  },
};

const args = parseArgs(argsConfig, {
  helpArg: 'help',
  headerContentSections: [
    {
      header: 'Stitch Open',
      content:
        'Open a GameMaker project using specified IDE and Runtime versions.\n\nThis command will install the IDE for you if the specified version is not already installed.\n\nIf no runtime version is specified, the IDE\'s specified "matching" runtime will be used.',
    },
  ],
});

// Get the target project
const targetProjectPaths = await StitchProjectStatic.listYypFilesRecursively(
  args.project,
);

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
