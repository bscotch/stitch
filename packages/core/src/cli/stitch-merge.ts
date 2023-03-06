#!/usr/bin/env node
import { Gms2MergeCliOptions, stitchCliMerge } from './lib/merge.js';
import {
  globalParams,
  mergeOptionsParams,
  mergeSourceParams,
  parseStitchArgs,
  targetParams,
} from './lib/params.js';

export const args = parseStitchArgs<Gms2MergeCliOptions>(
  {
    ...globalParams,
    ...targetParams,
    ...mergeSourceParams,
    ...mergeOptionsParams,
  },
  {
    title: 'Stitch Merge',
    description: 'Merge assets from one GameMaker project into another.',
  },
);

await stitchCliMerge(args);
