#!/usr/bin/env node
import commander, { CommanderStatic } from "commander";
import { oneline, undent } from "@bscotch/utility";
import {assignAudioGroups, AssignCliOptions} from './lib/assign';
import options from "./lib/cli-options";
import { addDebugOptions } from "./lib/addDebugOption";

const cli = commander;

cli.description(undent`
  Assign all audios in a GMS IDE folder to a group.`)
  .requiredOption("--folder <folder>", undent`
    This is the folder name shown in the GMS IDE, not the folder name of the actual audio file.
    For example, a audio called "snd_title" is shown in the "Sounds" folder in the IDE, whereas
    the actual audio file might be at "project/sounds/snd_title/snd_title.yy".
  `)
  .requiredOption("--group-name <name>", oneline`
    The name of the audio group. If it does not exist, it will be created.
  `)
  .option(...options.targetProject)
  .option(...options.force);
addDebugOptions(cli)
  .parse(process.argv);

assignAudioGroups(cli.opts() as AssignCliOptions);