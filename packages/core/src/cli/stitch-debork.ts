#!/usr/bin/env node
import { cli, chain } from 'cli-forge';
import { StitchProject } from '../lib/StitchProject.js';
import { addDebugOptions } from './lib/addDebugOption.js';
import options from './lib/cli-options.js';
import { oneline } from '@bscotch/utility';

export const deborkCommand = cli('debork', {
  description: oneline`
  Run Stitch on the project without making any changes,
  which will clean up some common issues and normalize the file content.
`,
  builder: (cli) =>
    chain(cli, options.targetProject, options.force, addDebugOptions),
  handler: async (args) => {
    (
      await StitchProject.load({
        projectPath: args.targetProject,
        dangerouslyAllowDirtyWorkingDir: args.force,
      })
    ).save();
  },
});
