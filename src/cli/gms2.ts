#!/usr/bin/env node
import commander from "commander";
import version from "./lib/project-version";

export const cli = commander;

// Kick it off
cli.version(version, '-v, --version')
  .description('Gamemaker Studio 2: Pipeline Development Kit CLI')
  .command("import",  "Import assets to Gamemaker Studio 2 projects.")
  .command("jsonify", "Convert every .yy and .yyp file into valid JSON.");

// Do the work!
cli.parse(process.argv);
