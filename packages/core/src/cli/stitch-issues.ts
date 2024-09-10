#!/usr/bin/env node
import { prettifyErrorTracing, replaceFilePaths } from '@bscotch/validation';
import { cli } from 'cli-forge';
import { createCommand } from './stitch-issues-create.js';
import { openCommand } from './stitch-issues-open.js';
import { submitCommand } from './stitch-issues-submit.js';

prettifyErrorTracing({ replaceFilePaths });

export const issuesCommand = cli('issues', {
  description: 'Create and manage issues to report to GameMaker.',
  builder: (cli) => cli.commands(createCommand, openCommand, submitCommand),
});
