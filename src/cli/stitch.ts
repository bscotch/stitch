#!/usr/bin/env node
import { oneline } from "@bscotch/utility";
import commander from "commander";
import version from "./lib/package-version";

export const cli = commander;

// Kick it off
cli.version(version, '-v, --version')
  .description('Stitch')
  .command("merge", "Merge two GameMaker Studio 2 projects together.")
  .command("add",  "Create assets (e.g. sprites) using external resources (e.g. images).")
  .command("set",  "Modify metadata in GameMaker Studio 2 projects.")
  .command("debork", oneline`
    Run Stitch on the project without making any changes,
    which will clean up some common issues and normalize the file content.
  `);

// @shichen85 Does this do anything?

//Trim the input and filter out empty space inputs such as " "
const args = process.argv.map(arg=>arg.trim());

// Do the work!
cli.parse(args);
