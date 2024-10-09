#!/usr/bin/env node
import { cli } from 'cli-forge';

import { audioGroupCommand } from './stitch-set-audio-group.js';
import { textureGroupCommand } from './stitch-set-texture-group.js';
import { versionCommand } from './stitch-set-version.js';

export const setCommand = cli('set', {
  description: 'Modify metadata in GameMaker Studio 2 projects.',
  builder: (cli) =>
    cli.commands(audioGroupCommand, textureGroupCommand, versionCommand),
});
