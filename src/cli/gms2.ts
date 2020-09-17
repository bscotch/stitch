#!/usr/bin/env node
import commander from "commander";

export const cli = commander;

// Kick it off
cli.description('Gamemaker Studio 2: Pipeline Development Kit CLI')
  .command("jsonify", "Convert every .yy and .yyp file into valid JSON.");

// Do the work!
cli.parse(process.argv);
