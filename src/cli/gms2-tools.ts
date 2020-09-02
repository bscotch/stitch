#!/usr/bin/env node
import commander from "commander";
import version from "./lib/project-version";

export const cli = commander;

// Kick it off
cli.version(version, '-v, --version')
  .description('GMS2-Tools')
  .command("debork", "Loads the project file and fixes it up.")
  .command("audio", "Manage audio.")
  .command("textures", "Manage texture page assignments");

// Do the work!
cli.parse(process.argv);