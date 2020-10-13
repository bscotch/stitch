#!/usr/bin/env node
import commander, { CommanderStatic } from "commander";
import { oneline, undent } from "@bscotch/utility";
import importSprites from "./lib/import-sprites";
import { ImportBaseOptions } from "./lib/import-base-options";

const cli = commander;

cli.description(undent`
    Import sprite assets collection of images.
    A 'sprite' source is any folder whose immediate children
    are all PNGs with identical dimensions. Sprites can be
    nested.
    If the asset does not already exists in the target project,
    it will be placed in the "NEW" folder.
    Otherwise, the asset will be replaced by the source asset.`)
  .requiredOption("--source-path <path>", oneline`
    Path to the sprite folder or root folder containing multiple sprites.
  `)
  .option("--target-project-path <path>", oneline`
    Path to the target Gamemaker Studio 2 project. If not set, will use the current directory.
  `)
  .parse(process.argv);

importSprites(cli as ImportBaseOptions & CommanderStatic);
