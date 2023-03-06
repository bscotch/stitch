#!/usr/bin/env node
import { oneline } from '@bscotch/utility';
import { prettifyErrorTracing, replaceFilePaths } from '@bscotch/validation';
import { program as cli } from 'commander';
import { dirname } from 'path';
import { fileURLToPath } from 'url';
import version from './lib/package-version.js';

prettifyErrorTracing({ replaceFilePaths });
const dir = dirname(fileURLToPath(import.meta.url));

// Kick it off
cli
  .executableDir(dir)
  .version(version, '-v, --version')
  .description('Stitch')
  .command('archive', 'Create a .yyz archive of a GameMaker project.')
  .command(
    'open',
    'Open a GameMaker project with a specific IDE and Runtime version.',
  )
  .command('issues', 'Create and manage issues to report to GameMaker.')
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
