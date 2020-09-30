#!/usr/bin/env node
import commander, { CommanderStatic } from "commander";
import { oneline, undent } from "../lib/strings";
import {assignAudioGroups, AssignCliOptions} from './lib/assign';

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
  .option("--target-project-path <path>", oneline`
    Path to the target Gamemaker Studio 2 project. If not set, will use the current directory.
  `)
  .parse(process.argv);

assignAudioGroups(cli as AssignCliOptions & CommanderStatic);