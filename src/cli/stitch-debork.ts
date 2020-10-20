#!/usr/bin/env node
import commander from "commander";
import { Gms2Project } from "../lib/Gms2Project";
import options from "./lib/cli-options";
const cli = commander;

cli.description("Fix and normalize common issues in a GameMaker Studio 2.3+ Project.")
  .option(...options.targetProjectPath)
  .option(...options.force)
  .parse(process.argv);

(new Gms2Project({projectPath:cli.targetProjectPath,dangerouslyAllowDirtyWorkingDir:cli.force})).save();
