#!/usr/bin/env node
import { cli } from 'cli-forge';

import { addFilesCommand } from './stitch-add-files.js';
import { addSoundsCommand } from './stitch-add-sounds.js';
import { addSpritesCommand } from './stitch-add-sprites.js';

export const addCommand = cli('add', {
  description:
    'Create assets (e.g. sprites) using external resources (e.g. images).',
  builder: (cli) =>
    cli.commands(addFilesCommand, addSoundsCommand, addSpritesCommand),
});
