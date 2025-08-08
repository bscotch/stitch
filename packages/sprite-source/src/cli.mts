#!/usr/bin/env node

import { pathy } from '@bscotch/pathy';
import { defineCommand, runMain } from 'citty';
import meta from '../package.json' with { type: 'json' };
import { SpriteDest } from './SpriteDest.js';
import { SpriteSource } from './SpriteSource.js';

const main = defineCommand({
  meta: {
    name: 'spsrc',
    version: meta.version,
    description: 'sprite-source pipeline utilities',
  },
  subCommands: {
    'add-source': defineCommand({
      meta: {
        name: 'add-source',
        description:
          'ensure that a sprite source directory is initialized and use it in a destination GameMaker project',
      },
      args: {
        source: {
          type: 'positional',
          description: 'a directory serving as a sprite source root',
          required: true,
          valueHint: '.',
        },
        project: {
          type: 'positional',
          description:
            'path to the .yyp file for the target GameMaker project from which the sprites should be imported',
          valueHint: 'path/to/project.yyp',
        },
      },
      async run(context) {
        const src = await SpriteSource.from(context.args.source as string);
        const srcConfig = await src.loadConfig();
        // Ensure a source config with a default stage
        if (!srcConfig.staging?.length) {
          srcConfig.staging = [{ dir: '.', transforms: [] }];
          await src.loadConfig(srcConfig);
        }
        // Ensure a dest config that imports it
        const dest = await SpriteDest.from(context.args.project as string);
        const destConfig = await dest.loadConfig();
        destConfig.sources ||= [];
        const relativeSourcePath = dest.yypPath
          .up()
          .relativeTo(src.spritesRoot);
        if (
          !destConfig.sources.find((src) =>
            pathy(src.source).equals(relativeSourcePath),
          )
        ) {
          destConfig.sources.push({
            source: relativeSourcePath,
          });
          // Reload with this new config as an override
          await dest.loadConfig(destConfig);
        }
      },
    }),
  },
});

runMain(main);
