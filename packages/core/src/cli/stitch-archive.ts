#!/usr/bin/env node
import {
  globalParams,
  loadProjectFromArgs,
  parseStitchArgs,
  targetProjectParam,
} from './lib/params.js';

const args = parseStitchArgs(
  {
    ...globalParams,
    ...targetProjectParam,
  },
  {
    title: 'Archive',
    description: `Create a .yyz archive of a GameMaker project. This is useful for sharing a project with others, including for GameMaker support tickets.`,
  },
);

// Note: Adding an issue template doesn't have any impact
// on project state, since it could be submitted at some
// other time, so we can always bypass the dirty working dir
// check.
const targetProject = await loadProjectFromArgs({ ...args, force: true });

await targetProject.exportYyz();
