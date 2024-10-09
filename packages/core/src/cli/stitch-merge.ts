#!/usr/bin/env node
import { cli, chain } from 'cli-forge';
import { stitchCliMerge } from './lib/merge.js';
import {
  withGlobalParams,
  withMergeOptionsParams,
  withMergeSourceParams,
  withTargetParams,
} from './lib/params.js';

export const mergeCommand = cli('merge', {
  description: 'Merge two GameMaker Studio 2 projects together.',
  builder: (cli) =>
    chain(
      cli,
      withGlobalParams,
      withTargetParams,
      withMergeSourceParams,
      withMergeOptionsParams,
    ),
  handler: async (args) => {
    await stitchCliMerge(args);
  },
});
