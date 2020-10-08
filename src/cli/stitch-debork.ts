#!/usr/bin/env node
import commander from "commander";
import { Gms2Project } from "../lib/Gms2Project";
import { oneline } from "../lib/strings";
const cli = commander;

cli.description("Fix and normalize common issues in a Gamemaker Studio 2.3+ Project.")
  .option("--target-project-path <path>", oneline`
    Path to the target Gamemaker Studio 2 project. If not set, will use the current directory.
  `)
  .parse(process.argv);

(new Gms2Project(cli.targetProjectPath)).save();
