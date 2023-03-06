#!/usr/bin/env node
import { oneline } from '@bscotch/utility';
import { program } from 'commander';

import { dirname } from 'path';
import { fileURLToPath } from 'url';
const dir = dirname(fileURLToPath(import.meta.url));

program
  .executableDir(dir)
  .description('Spritely: Image correction and cleanup for 2D game sprites')
  .command(
    'fix',
    'Perform all correction/cleanup tasks (including cropping and bleeding).',
  )
  .command(
    'bleed',
    oneline`
    Add a single-pixel low-alpha outline around foreground
    objects to improve aliasing.
  `,
  )
  .alias('alphaline')
  .command(
    'crop',
    oneline`
    Autocrop the subimages of a sprite while maintaining relative positions.
  `,
  )
  .command(
    'skin',
    oneline`
    Use gradient maps to create reskinned sprites.
  `,
  )
  .alias('gradmap')
  .parse();
