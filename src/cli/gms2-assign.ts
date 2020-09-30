#!/usr/bin/env node
import commander from "commander";
const cli = commander;

cli.description("Modify resource group assignments in Gamemaker Studio 2 projects.")
  .command("texture-groups", "Modify texture group assignments.")
  .command("audio-groups", "Modify audio group assignments.")
  .parse(process.argv);

