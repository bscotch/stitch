#!/usr/bin/env node
import commander from "commander";
const cli = commander;

cli.description("Import assets to Gamemaker Studio 2 projects.")
  .command("modules", "Import modules from a source Gamemaker Studio 2 project to a target project.")
  .parse(process.argv);
