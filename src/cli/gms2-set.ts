#!/usr/bin/env node
import commander from "commander";
const cli = commander;

cli.description("Modify metadata in Gamemaker Studio 2 projects.")
  .command("version", "Modify the versions for all export platforms.")
  .parse(process.argv);

