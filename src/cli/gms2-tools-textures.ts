#!/usr/bin/env node
import commander from "commander";
import {Project} from "../project/Project";
import chalk from "chalk";

export const cli = commander;

cli.description(`Manage Texture page folder assignments.`)
  .usage("[options] <track|untrack|list>")
  .option("-p --project <yyp>","Path of the project's YYP file. Will recursively look for YYP file starting from the current working directory if not specified.")
  .option("-f, --folder <path>", "The folder heirarchy in the Game Maker project file. Case insensitive.")
  .option("-t, --texture <name>", "The name of the texture group. Case insensitive.")
  .parse(process.argv);

function log(...things:any[]) {
  console.log(chalk.rgb(255, 3, 98)(...things));
}

function trackTexture(project:Project, folderPath:string, textureName:string) {
  if (!folderPath || !textureName) {
    throw new Error("Tracking a texture requires both a folder and a texture.");
  }
  project.addFolderToTextureGroup(folderPath,textureName);
  log(`Added folder ${folderPath} to texture group ${textureName}`);
}

function unTrackTexture(project:Project, folderPath?:string, textureName?:string) {
  if (!(folderPath || textureName)) {
    throw new Error("Tracking a texture requires a folder or a texture.");
  }
  if (folderPath && textureName) {
    throw new Error("Choose either a folder or texture to untrack.");
  }
  if (folderPath) {
    project.removeFolderFromTextureGroups(folderPath);
    log(`No longer tracking folder ${folderPath} for texture assignments.`);
  }
  else if (textureName) {
    project.removeTextureGroupAssignments(textureName);
    log(`No longer tracking texture group ${textureName} for texture assignments.`);
  }
}

function listTexture(project:Project, folderPath?:string, textureName?:string) {
  const assignments = project.textureFolderAssignments;
  for (const thisTextureName of Object.keys(assignments)) {
    if (textureName && thisTextureName != textureName) {
      continue;
    }
    const theseFolders = assignments[thisTextureName];
    if (folderPath && !theseFolders.includes(folderPath)) {
      continue;
    }
    else if (folderPath) {
      log(thisTextureName);
      break;
    }
    else {
      log(thisTextureName, ":", theseFolders.join(", "));
    }
  }
}

function main() {
  const commandType = cli.args[0];
  const {project, folder, texture} = cli;
  const loadedProject = new Project(project);

  switch (commandType) {
    case "track":
      trackTexture(loadedProject, folder, texture);
      break;
    case "untrack":
      unTrackTexture(loadedProject, folder, texture);
      break;
    case "list":
      listTexture(loadedProject, folder, texture);
      break;
  }
}

main();