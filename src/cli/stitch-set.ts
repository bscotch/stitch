#!/usr/bin/env node
import commander from "commander";
const cli = commander;

cli.description("Modify metadata in GameMaker Studio 2 projects.")
  .command("version", "Modify the versions for all export platforms.")
  .command("texture-group", "Modify texture group assignments.")
  .command("audio-group", "Modify audio group assignments.")
  .parse(process.argv);

