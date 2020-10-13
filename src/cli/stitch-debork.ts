#!/usr/bin/env node
import commander from "commander";
import { Gms2Project } from "../lib/Gms2Project";
import { oneline } from "@bscotch/utility";
const cli = commander;

cli.description("Fix and normalize common issues in a Gamemaker Studio 2.3+ Project.")
  .option("--target-project-path <path>", oneline`
    Path to the target Gamemaker Studio 2 project. If not set, will use the current directory.
  `)
  .option("--force",oneline`
    Normally you can only debork if your git working directory is clean.
    You can bypass this if you really know what you're doing.
  `)
  .parse(process.argv);

(new Gms2Project({projectPath:cli.targetProjectPath,dangerouslyAllowDirtyWorkingDir:cli.force})).save();
