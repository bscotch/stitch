#!/usr/bin/env node
import commander from "commander";
import version from "./lib/package-version";

export const cli = commander;

// Kick it off
cli.version(version, '-v, --version')
  .description('Gamemaker Studio 2: Pipeline Development Kit CLI')
  .command("import",  "Import assets to Gamemaker Studio 2 projects.")
  .command("set",  "Modify metadata in Gamemaker Studio 2 projects.")
  .command("jsonify", "Convert .yy and .yyp files into valid JSON.");

//Trim the input and filter out empty space inputs such as " "
const args = process.argv.map(arg=>arg.trim());

// Do the work!
cli.parse(args);
