#!/usr/bin/env node
import commander, { CommanderStatic } from "commander";
import { oneline } from "@bscotch/utility";
import import_modules, { ImportModuleOptions } from './lib/import-modules';
import options from "./lib/cli-options";

const cli = commander;

cli.description("Import modules from a source Gamemaker Studio 2 project to a target project.")
  .requiredOption("--source-project-path <path>", oneline`
    Path to the source Gamemaker Studio 2 project.
  `)
  .requiredOption("--modules <names...>", oneline`
    The names of the modules in the source project to import.
  `)
  .option(...options.targetProjectPath)
  .option(...options.force)
  .parse(process.argv);

import_modules(cli as (ImportModuleOptions & CommanderStatic));