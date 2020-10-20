#!/usr/bin/env node
import commander from "commander";
const cli = commander;

cli.description("Import assets to GameMaker Studio 2 projects.")
  .command("modules", "Import modules from a source GameMaker Studio 2 project to a target project.")
  .command("sounds", "Import sound assets from a file or a path to a target project.")
  .command("sprites", "Import sprite assets from a collection of images.")
  .command("files", "Import included files assets from a file or a path to a target project.")
  .parse(process.argv);

