#!/usr/bin/env node
import commander from "commander";
import version from "./lib/package-version";

export const cli = commander;

// Kick it off
cli.version(version, '-v, --version')
  .description('Stitch')
  .command("import",  "Import assets to Gamemaker Studio 2 projects.")
  .command("set",  "Modify metadata in Gamemaker Studio 2 projects.")
  .command("debork", "Run Stitch on the project without making any changes, which will clean up some common issues and normalize the file content.")
  .command("jsonify", "Convert .yy and .yyp files into valid JSON.");

//Trim the input and filter out empty space inputs such as " "
const args = process.argv.map(arg=>arg.trim());

// Do the work!
cli.parse(args);
