#!/usr/bin/env node
import { oneline } from '@bscotch/utility';
import { program } from 'commander';
import { cliOptions, runFixer, SpritelyCliGeneralOptions } from './util.js';

async function runCliCommand() {
  program
    .description('Spritely: Apply gradient maps')
    .option(...cliOptions.folder)
    .option(...cliOptions.recursive)
    .option(...cliOptions.mismatch)
    .option(...cliOptions.rootImages)
    .option(...cliOptions.match)
    .option(...cliOptions.debug)
    .option(
      '-d --delete-source',
      'Optionally delete source images after applying gradients.',
    )
    .option(
      '-g --gradient-maps-file <file>',
      oneline`
      By default, gradient maps are expected to be named 'gradmap.yml' and live
      inside the sprite's folder (so that each sprite can have a separate
      set of mappings). You can optionally override this behavior and point
      to a gradient map file that will be used by *all* sprites.
    `,
    )
    .parse();

  await runFixer(
    ['applyGradientMaps'],
    program.opts() as SpritelyCliGeneralOptions,
  );
}

void runCliCommand();
