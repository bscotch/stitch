#!/usr/bin/env node
import { program as cli } from 'commander';

cli
  .description('Create GameMaker Studio 2 resources.')
  .command(
    'sounds',
    'Create sound assets from a file or a path to a target project.',
  )
  .command('sprites', 'Create sprite assets from a collection of images.')
  .command(
    'files',
    'Create included files assets from a file or a path to a target project.',
  )
  .parse(process.argv);
