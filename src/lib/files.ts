/**
 * @file Gamemaker files and file-system needs have some specificies that
 * aren't dealth with by native fs or popular library fs-extra. This module
 * should be used for any file system operations, so that only those methods
 * that we know won't create problems will be exported and useable (and any
 * methods that would create problems can be rewritten).
 */

import fs from "fs-extra";
import path from "./paths";
import {writeFileSync as writeJsonSync,loadFromFileSync as readJsonSync} from "./json";
import { assert } from "./errors";

function ensureDirSync(dir:string){
  if(!fs.existsSync(dir)){
    fs.mkdirSync(dir,{recursive:true});
  }
  assert(fs.statSync(dir).isDirectory(),`Path ${dir} is not a directory.`);
}

/** Write file while ensuring the parent directories exist. */
function writeFileSync(filePath:string,stuff:string|Buffer){
  ensureDirSync(path.dirname(filePath));
  fs.writeFileSync(filePath,stuff);
}

function listPathsSync(dir:string,recursive=false){
  const paths = fs.readdirSync(dir)
    .map(aPath=>path.join(dir,aPath));
  if(recursive){
    const morePaths = paths
      .filter(path=>fs.statSync(path).isDirectory())
      .map(dir=>listPathsSync(dir,true))
      .flat(3);
    paths.push(...morePaths);
  }
  paths.sort(path.pathSpecificitySort);
  return paths;
}


function listFoldersSync(dir:string,recursive=false){
  return listPathsSync(dir,recursive)
    .filter(pathName=>fs.statSync(pathName).isDirectory());
}

function listFilesSync(dir:string,recursive=false){
  return listPathsSync(dir,recursive)
    .filter(filePath=>fs.statSync(filePath).isFile());
}

function listFilesByExtensionSync(dir:string,extension:string|string[],recursive=false){
  const extensions = Array.isArray(extension) ? extension : [extension];
  return listFilesSync(dir,recursive)
    .filter(fileName=>{
      const ext = path.parse(fileName).ext.slice(1);
      return extensions.includes(ext);
    });
}

export default {
  // Override with custom methods, and add new ones
  existsSync: fs.existsSync,
  ensureDirSync,
  copyFileSync: fs.copyFileSync,
  copySync: fs.copySync,
  emptyDirSync: fs.emptyDirSync,
  writeFileSync,
  writeJsonSync,
  readJsonSync,
  listPathsSync,
  listFoldersSync,
  listFilesSync,
  listFilesByExtensionSync,
};

