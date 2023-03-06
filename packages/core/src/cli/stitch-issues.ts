#!/usr/bin/env node
import { prettifyErrorTracing, replaceFilePaths } from '@bscotch/validation';
import { program as cli } from 'commander';

prettifyErrorTracing({ replaceFilePaths });

// Kick it off
cli
  .description('Stitch Issues')
  .command(
    'create',
    'Create an issue template for a bug report to submit to GameMaker.',
  )
  .command('open', 'Open files and folders from an existing issue project.')
  .command(
    'submit',
    'For a completed issue project, collect logs and compile a report for submission to GameMaker. (Only works with GameMaker Enterprise.)',
  )
  .parse();
