#!/usr/bin/env node
import commander, { CommanderStatic } from "commander";
import { oneline, undent } from "@bscotch/utility";
import importSounds from "./lib/import-sounds";
import { ImportBaseOptions } from "./lib/import-base-options";

const cli = commander;

cli.description(undent`
    Import sound assets from a file or a path.
    If the asset does not already exists in the target project, it will be placed in the "NEW" folder.
    Otherwise, the asset will be replaced by the source asset.`)
  .requiredOption("--source-path <path>", oneline`
    Path to the sound file or the folder containing the sounds files.
  `)
  .option("--allow-extensions <extensions...>", oneline`
    input one or more of the supported extensions: mp3, wav, ogg, wma. 
    If not set, Will attempt to import all supported extensions.
  `)
  .option("--target-project-path <path>", oneline`
    Path to the target Gamemaker Studio 2 project. If not set, will use the current directory.
  `)
  .parse(process.argv);

importSounds(cli as ImportBaseOptions & CommanderStatic);