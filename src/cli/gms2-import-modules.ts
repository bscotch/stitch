#!/usr/bin/env node
import commander from "commander";
import { oneline } from "../lib/strings";
import import_modules from './lib/import-modules';

const cli = commander;


cli.description("Import modules from a source Gamemaker Studio 2 project to a target project.")
  .option("--source_project <path>", oneline`
    Directory to the source Gamemaker Studio 2 project.
  `)
  .option("--modules <names...>", oneline`
    The names of the modules in the source project to import.
  `)
  .option("--target_project [path]", oneline`
    Directory to the target Gamemaker Studio 2 project. If not set, will use the current directory.
  `)
  .parse(process.argv);

import_modules(cli.source_project, cli.modules, cli.target_project);