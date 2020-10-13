#!/usr/bin/env node
import commander, { CommanderStatic } from "commander";
import { oneline, undent } from "@bscotch/utility";
import version, {VersionOptions} from './lib/version';

const cli = commander;

cli.description(undent`
  Set the project version in all options files.
  (Note that the PS4 and Switch options files do not include the version
  and must be set outside of Gamemaker).`)
  .requiredOption("--project-version <version>", undent`
    Can use one of:
      + "0.0.0.0" syntax (exactly as Gamemaker stores versions)
      + "0.0.0" syntax (semver without prereleases -- the 4th value will always be 0)
      + "0.0.0-rc.0" syntax (the 4th number will be the RC number)
      The four numbers will appear in all cases as the string "major.minor.patch.candidate"
  `)
  .option("--target-project-path <path>", oneline`
    Path to the target Gamemaker Studio 2 project. If not set, will use the current directory.
  `)
  .parse(process.argv);

version(cli as VersionOptions & CommanderStatic);