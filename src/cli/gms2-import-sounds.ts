#!/usr/bin/env node
import commander from "commander";
import { oneline } from "../lib/strings";
import importSounds from "./lib/import-sounds";

const cli = commander;


cli.description("Import sound assets from a file or a path to a target project.")
  .requiredOption("--source_asset_path <path>", oneline`
    Directory to the source Gamemaker Studio 2 project.
  `)
  .option("--target_project_path <path>", oneline`
    Directory to the target Gamemaker Studio 2 project. If not set, will use the current directory.
  `)
  .parse(process.argv);

importSounds(cli.source_project, cli.modules, cli.target_project);