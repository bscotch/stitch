#!/usr/bin/env node
import commander from "commander";
import {Project} from "../project/Project";

export const cli = commander;

cli.description("Loads the YYP file and fixes it.")
  .option("-p --project <yyp>","Path of the project's YYP file. Will recursively look for YYP file starting from the current working directory if not specified.")
  .parse(process.argv);

function main() {
  const projectPath = cli.project;
  new Project(projectPath);
  console.log("  Project was successfully deborked.");
}

main();