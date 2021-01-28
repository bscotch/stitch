#!/usr/bin/env node
import commander, { CommanderStatic } from "commander";
import { Gms2Project } from "../lib/Gms2Project";
import options from "./lib/cli-options";
const cli: CommanderStatic & {
  targetProject?: string,
  force?: boolean
} = commander;

cli.description("Fix and normalize common issues in a GameMaker Studio 2.3+ Project.")
  .option(...options.targetProject)
  .option(...options.force)
  .parse(process.argv);

const opts = cli.opts();
(new Gms2Project({projectPath:opts.targetProject,dangerouslyAllowDirtyWorkingDir:opts.force})).save();
