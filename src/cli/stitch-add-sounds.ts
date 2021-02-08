#!/usr/bin/env node
import commander, { CommanderStatic } from "commander";
import { oneline, undent } from "@bscotch/utility";
import importSounds from "./lib/add-sounds";
import { ImportBaseOptions } from "./lib/add-base-options";
import options from "./lib/cli-options";
import { addDebugOptions } from "./lib/addDebugOption";

const cli = commander;

cli.description(undent`
    Create/update sound assets from a file or a path.
    If the asset does not already exists in the target project, it will be placed in the "NEW" folder.
    Otherwise, the asset will be replaced by the source asset.`)
  .requiredOption("--source <path>", oneline`
    Path to the sound file or the folder containing the sounds files.
  `)
  .option("--extensions <extensions...>", oneline`
    input one or more of the supported extensions: mp3, wav, ogg, wma. 
    If not set, Will attempt to import all supported extensions.
  `)
  .option(...options.targetProject)
  .option(...options.force);
addDebugOptions(cli)
  .parse(process.argv);

importSounds(cli.opts() as ImportBaseOptions);
