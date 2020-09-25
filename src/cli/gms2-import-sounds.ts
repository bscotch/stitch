#!/usr/bin/env node
import commander, { CommanderStatic } from "commander";
import { oneline } from "../lib/strings";
import importSounds, {ImportSoundsOptions} from "./lib/import-sounds";

const cli = commander;

cli.description("Import sound assets from a file or a path to a target project.")
  .requiredOption("--source_path <path>", oneline`
    Path to the sound file or the folder containing the sounds files.
  `)
  .option("--extensions <extensions...>", oneline`
    When source_path is a folder,
    input one or more of the supported extensions: mp3, wav, ogg, wma. 
    If undefined, Will attempt to import all supported extensions.
  `)
  .option("--target_project_path <path>", oneline`
    Directory to the target Gamemaker Studio 2 project. If not set, will use the current directory.
  `)
  .parse(process.argv);

importSounds(cli as ImportSoundsOptions & CommanderStatic);