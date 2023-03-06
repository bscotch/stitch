#!/usr/bin/env node
import { program as cli } from 'commander';
import { StitchProject } from '../lib/StitchProject.js';
import { addDebugOptions } from './lib/addDebugOption.js';
import options from './lib/cli-options.js';

cli
  .description(
    'Fix and normalize common issues in a GameMaker Studio 2.3+ Project.',
  )
  .option(...options.targetProject)
  .option(...options.force);
addDebugOptions(cli).parse(process.argv);

const opts = cli.opts();
(
  await StitchProject.load({
    projectPath: opts.targetProject,
    dangerouslyAllowDirtyWorkingDir: opts.force,
  })
).save();
