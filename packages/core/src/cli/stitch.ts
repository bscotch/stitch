#!/usr/bin/env node
import { prettifyErrorTracing, replaceFilePaths } from '@bscotch/validation';
import { cli } from 'cli-forge';
import version from './lib/package-version.js';
import { addCommand } from './stitch-add.js';
import { archiveCommand } from './stitch-archive.js';
import { deborkCommand } from './stitch-debork.js';
import { issuesCommand } from './stitch-issues.js';
import { mergeCommand } from './stitch-merge.js';
import { lintCommand } from './stitch-lint.js';
import { openCommand } from './stitch-open.js';
import { setCommand } from './stitch-set.js';

prettifyErrorTracing({ replaceFilePaths });

const stitch = cli('stitch', {
  builder: (cli) =>
    cli
      .commands(
        addCommand,
        archiveCommand,
        deborkCommand,
        issuesCommand,
        mergeCommand,
        lintCommand,
        openCommand,
        setCommand,
      )
      .version(version),
});

// Kick it off
await stitch.forge();
