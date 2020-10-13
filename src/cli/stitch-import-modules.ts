#!/usr/bin/env node
import commander, { CommanderStatic } from "commander";
import { oneline } from "@bscotch/utility";
import import_modules, { ImportModuleOptions } from './lib/import-modules';

const cli = commander;

cli.description("Import modules from a source Gamemaker Studio 2 project to a target project.")
  .requiredOption("--source-project-path <path>", oneline`
    Path to the source Gamemaker Studio 2 project.
  `)
  .requiredOption("--modules <names...>", oneline`
    The names of the modules in the source project to import.
  `)
  .option("--target-project <path>", oneline`
    Path to the target Gamemaker Studio 2 project. If not set, will use the current directory.
  `)
  .parse(process.argv);

import_modules(cli as (ImportModuleOptions & CommanderStatic));