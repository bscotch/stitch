#!/usr/bin/env node
import commander, { CommanderStatic } from "commander";
import { undent } from "@bscotch/utility";
import version, {VersionOptions} from './lib/version';
import options from "./lib/cli-options";
import { addDebugOptions } from "./lib/addDebugOption";

const cli = commander;

cli.description(undent`
  Set the project version in all options files.
  (Note that the PS4 and Switch options files do not include the version
  and must be set outside of GameMaker).`)
  .requiredOption("--project-version <version>", undent`
    Can use one of:
      + "0.0.0.0" syntax (exactly as GameMaker stores versions)
      + "0.0.0" syntax (semver without prereleases -- the 4th value will always be 0)
      + "0.0.0-rc.0" syntax (the 4th number will be the RC number)
      The four numbers will appear in all cases as the string "major.minor.patch.candidate"
  `)
  .option(...options.targetProject)
  .option(...options.force);
addDebugOptions(cli)
  .parse(process.argv);

version(cli.opts() as VersionOptions);