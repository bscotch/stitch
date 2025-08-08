#!/usr/bin/env node

import { pathy } from '@bscotch/pathy';
import { defineCommand, runMain } from 'citty';
import { pathToFileURL } from 'node:url';
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
        description: `ensure that a sprite source directory is initialized and use it in a destination GameMaker project (doesn't overwrite your configs if they're already set up)`,
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
            'path to the .yyp file for the target GameMaker project (or folder containing that file) into which the sprites should be imported',
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
        console.log('Edit your source config at');
        console.log(pathToFileURL(src.configFile.relative).toString());
        console.log();
        // Ensure a dest config that imports it
        let projectYypPath = pathy(context.args.project as string);
        if (!projectYypPath.hasExtension('yyp')) {
          // Assume it's a directory containing a yyp file and find it
          projectYypPath = (await pathy(projectYypPath).findChild(/\.yyp$/))!;
          if (!projectYypPath) {
            console.error(
              'Provided project path was neither a yyp file nor a folder containing one.',
            );
            process.exit(1);
          }
        }
        const dest = await SpriteDest.from(projectYypPath);
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
        console.log('Edit your project config at');
        console.log(pathToFileURL(dest.configFile.relative).toString());
        console.log();
      },
    }),
    import: defineCommand({
      meta: {
        name: 'import',
        description:
          'import new/updated sprites from any configured sprite sources into a GameMaker project',
      },
      args: {
        project: {
          type: 'positional',
          default: '.',
          description:
            'path to the GameMaker project, either the yyp file or the folder containing it',
          required: false,
        },
      },
      async run(context) {
        // Find the project
        let projectYypPath = pathy((context.args.project as string) || '.');
        if (!projectYypPath.hasExtension('yyp')) {
          // Assume it's a directory containing a yyp file and find it
          projectYypPath = (await pathy(projectYypPath).findChild(/\.yyp$/))!;
          if (!projectYypPath) {
            console.error(
              'Provided project path was neither a yyp file nor a folder containing one.',
            );
            process.exit(1);
          }
        }
        const dest = await SpriteDest.from(projectYypPath);
        console.log('Importing new and updated sprites...');
        const results = await dest.import();
        for (const result of results || []) {
          console.log('  ✅', result.resource.name);
        }
        if (!results?.length) {
          console.log('  No changes found.');
        } else {
          console.log('Import complete!');
        }
      },
    }),
  },
});

runMain(main);
