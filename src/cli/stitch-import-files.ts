#!/usr/bin/env node
import commander, { CommanderStatic } from "commander";
import { oneline, undent } from "@bscotch/utility";
import { ImportBaseOptions } from "./lib/import-base-options";
import importFiles from "./lib/import-files";

const cli = commander;

cli.description(undent`
  Import included file assets from a file or a path.
  If the asset does not already exists in the target project, it will be placed in the "NEW" folder.
  Otherwise, the asset will be replaced by the source asset.`)
  .requiredOption("--source-path <path>", oneline`
    Path to the file or the folder containing the files to import.
  `)
  .option("--allow-extensions <extensions...>", oneline`
    Only allow certain extensions to be imported. 
    If not set, Will attempt to import all files.
  `)
  .option("--target-project-path <path>", oneline`
    Path to the target Gamemaker Studio 2 project. If not set, will use the current directory.
  `)
  .parse(process.argv);

importFiles(cli as ImportBaseOptions & CommanderStatic);