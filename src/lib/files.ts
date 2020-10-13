/**
 * @file Gamemaker files and file-system needs have some specificies that
 * aren't dealth with by native fs or popular library fs-extra. This module
 * should be used for any file system operations, so that only those methods
 * that we know won't create problems will be exported and useable (and any
 * methods that would create problems can be rewritten).
 */

import fs, { existsSync } from "fs-extra";
import path from "./paths";
import {writeFileSync as writeJsonSync,loadFromFileSync as readJsonSync} from "./json";
import { assert } from "./errors";
import sortKeys from "sort-keys";
import { warn } from "console";
import {
  listPathsSync,
  listFoldersSync,
  listFilesSync,
  listFilesByExtensionSync,
} from "@bscotch/utility";

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

function copyFileSync(sourcePath:string,targetPath:string){
  ensureDirSync(path.dirname(targetPath));
  fs.copyFileSync(sourcePath,targetPath);
}

/**
 * Convert yy(p) files and rewrite them as valid
 * JSON (no trailing commas) with consistent spacing, and
 * with fields alphabetized.
 * (Gamemaker .yy and .yyp files are *basically* JSON, and
 * if they are rewritten as valid JSON GMS2.3 can read them
 * just fine.)
 * @param path Path to a yy(p) file or a folder containing them.
 */
function convertGms2FilesToJson(path:string){
  assert(existsSync(path),`Cannot convert GMS2 files: ${path} does not exist.`);
  const targetFiles: string[] = [];
  if (fs.statSync(path).isFile()){
    targetFiles.push(path);
  }
  else{
    targetFiles.push(...listFilesByExtensionSync(path,['yy','yyp'],true));
  }
  for(const targetFile of targetFiles){
    assert(existsSync(targetFile),`Cannot convert GMS2 file: ${targetFile} does not exist.`);
    try{
      const parsed = readJsonSync(targetFile);
      writeJsonSync(targetFile,sortKeys(parsed,{deep:true}));
    }
    catch(err){
      warn(`Cannot convert file "${targetFile}" to regular JSON.`);
    }
  }
}


export default {
  // Override with custom methods, and add new ones
  // Note: If adding more methods here, either directly from fs(-extra)
  // or as custom method, ensure that it will work with wonky
  // Gamemaker file formats (e.g. yy and yyp files are JSON-like, but
  // have trailing commas and include BigInt values)
  chmodSync: fs.chmodSync,
  statSync: fs.statSync,
  existsSync: fs.existsSync,
  removeSync: fs.removeSync,
  ensureDirSync,
  copyFileSync,
  copySync: fs.copySync,
  emptyDirSync: fs.emptyDirSync,
  readFileSync: fs.readFileSync,
  writeFileSync,
  writeJsonSync,
  readJsonSync,
  listPathsSync,
  listFoldersSync,
  listFilesSync,
  listFilesByExtensionSync,
  convertGms2FilesToJson
};

