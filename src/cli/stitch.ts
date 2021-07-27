#!/usr/bin/env node
import { oneline } from '@bscotch/utility';
import version from './lib/package-version';
import { program as cli } from 'commander';

// Kick it off
cli
  .version(version, '-v, --version')
  .description('Stitch')
  .command('merge', 'Merge two GameMaker Studio 2 projects together.')
  .command(
    'add',
    'Create assets (e.g. sprites) using external resources (e.g. images).',
  )
  .command('set', 'Modify metadata in GameMaker Studio 2 projects.')
  .command(
    'debork',
    oneline`
    Run Stitch on the project without making any changes,
    which will clean up some common issues and normalize the file content.
  `,
  )
  .command('lint', 'Generate a lint report for a GameMaker Studio 2 project.')
  .parse();
