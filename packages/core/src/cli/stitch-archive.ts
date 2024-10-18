#!/usr/bin/env node
import { cli, chain } from 'cli-forge';
import {
  loadProjectFromArgs,
  withGlobalParams,
  withTargetProjectParam,
} from './lib/params.js';

export const archiveCommand = cli('archive', {
  description: `Create a .yyz archive of a GameMaker project.`,
  builder: (cli) => chain(cli, withGlobalParams, withTargetProjectParam),
  handler: async (args) => {
    // Note: Adding an issue template doesn't have any impact
    // on project state, since it could be submitted at some
    // other time, so we can always bypass the dirty working dir
    // check.
    const targetProject = await loadProjectFromArgs({ ...args, force: true });
    await targetProject.exportYyz();
  },
});
