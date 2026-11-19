#!/usr/bin/env node

import { pathy } from '@bscotch/pathy';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import meta from '../package.json' with { type: 'json' };
import { SpriteDest } from './SpriteDest.ts';
import { SpriteSource } from './SpriteSource.ts';

const commands = {
  'add-source': {
    usage: 'spsrc add-source <source> [project]',
    description: `ensure that a sprite source directory is initialized and use it in a destination GameMaker project (doesn't overwrite your configs if they're already set up)`,
    args: [
      ['source', 'a directory serving as a sprite source root (e.g. ".")'],
      [
        'project',
        'path to the .yyp file for the target GameMaker project (or folder containing that file) into which the sprites should be imported',
      ],
    ],
    run: addSource,
  },
  import: {
    usage: 'spsrc import [project]',
    description:
      'import new/updated sprites from any configured sprite sources into a GameMaker project',
    args: [
      [
        'project',
        'path to the GameMaker project, either the yyp file or the folder containing it (default: ".")',
      ],
    ],
    run: importSprites,
  },
} satisfies Record<
  string,
  {
    usage: string;
    description: string;
    args: [name: string, description: string][];
    run: (positionals: string[]) => Promise<void>;
  }
>;

type CommandName = keyof typeof commands;

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    help: { type: 'boolean', short: 'h' },
    version: { type: 'boolean', short: 'v' },
  },
});
const [commandName, ...commandArgs] = positionals;

if (values.version) {
  console.log(meta.version);
} else if (!commandName) {
  printMainHelp();
  process.exit(values.help ? 0 : 1);
} else if (!(commandName in commands)) {
  console.error(`Unknown command: ${commandName}\n`);
  printMainHelp();
  process.exit(1);
} else {
  const command = commands[commandName as CommandName];
  if (values.help) {
    printCommandHelp(commandName as CommandName);
  } else {
    await command.run(commandArgs);
  }
}

async function addSource([source, project = '.']: string[]) {
  if (!source) {
    console.error('Missing required argument: source\n');
    printCommandHelp('add-source');
    process.exit(1);
  }
  const src = await SpriteSource.from(source);
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
  let projectYypPath = pathy(project);
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
  const relativeSourcePath = dest.yypPath.up().relativeTo(src.spritesRoot);
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
}

async function importSprites([project = '.']: string[]) {
  // Find the project
  let projectYypPath = pathy(project);
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
}

function printMainHelp() {
  console.log(`spsrc v${meta.version}: sprite-source pipeline utilities\n`);
  console.log('Usage: spsrc <command> [...args]\n');
  console.log('Commands:');
  for (const [name, command] of Object.entries(commands)) {
    console.log(`  ${name.padEnd(12)} ${command.description}`);
  }
  console.log('\nRun `spsrc <command> --help` for command details.');
}

function printCommandHelp(name: CommandName) {
  const command = commands[name];
  console.log(`Usage: ${command.usage}\n`);
  console.log(`${command.description}\n`);
  console.log('Arguments:');
  for (const [arg, description] of command.args) {
    console.log(`  ${arg.padEnd(10)} ${description}`);
  }
}
