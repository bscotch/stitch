#!/usr/bin/env node
import commander, { CommanderStatic } from "commander";
import { oneline, undent } from "../lib/strings";
import {assignTextureGroups, AssignCliOptions} from './lib/assign';

const cli = commander;

cli.description(undent`
  Assign all sprites in a GMS IDE folder to a group.`)
  .requiredOption("--folder <folder>", undent`
    This is the folder name shown in the GMS IDE, not the folder name of the actual sprite file.
    For example, a sprite called "sp_title" is shown in the "Sprites" folder in the IDE, whereas
    the actual sprite file might be at "project/sprites/sp_title/sp_title.yy".
  `)
  .requiredOption("--group-name <name>", oneline`
    The name of the texture group. If it does not exist, it will be created.
  `)
  .option("--target-project-path <path>", oneline`
    Path to the target Gamemaker Studio 2 project. If not set, will use the current directory.
  `)
  .parse(process.argv);

assignTextureGroups(cli as AssignCliOptions & CommanderStatic);