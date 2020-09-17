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
  if(fs.statSync(dir).isFile()){
    return [dir];
  }
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

/**
 * List all files in a directory or, if 'dir' is already a file,
 * just return that filename as an array.
 */
function listFilesSync(dir:string,recursive=false){
  if(fs.statSync(dir).isFile()){
    return [dir];
  }
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

function copyFileSync(sourcePath:string,targetPath:string){
  ensureDirSync(path.dirname(targetPath));
  fs.copyFileSync(sourcePath,targetPath);
}

/**
 * Find all .yy and .yyp files and rewrite them as valid
 * JSON (no trailing commas) with consistent spacing, and
 * with fields alphabetized.
 * (Gamemaker .yy and .yyp files are *basically* JSON, and
 * if they are rewritten as valid JSON GMS2.3 can read them
 * just fine.)
 * @param path Either a yy(p) file or a directory containing some.
 */
function convertGms2FilesToJson(path:string){
  assert(existsSync(path),`Cannot convert GMS2 files: ${path} does not exist.`);
  const targetFiles: string[] = [];
  if(fs.statSync(path).isFile()){
    targetFiles.push(path);
  }
  else{
    targetFiles.push(...listFilesByExtensionSync(path,['yy','yyp'],true));
  }
  for(const targetFile of targetFiles){
    const parsed = readJsonSync(targetFile);
    writeJsonSync(targetFile,sortKeys(parsed,{deep:true}));
  }
}

export default {
  // Override with custom methods, and add new ones
  // Note: If adding more methods here, either directly from fs(-extra)
  // or as custom method, ensure that it will work with wonky
  // Gamemaker file formats (e.g. yy and yyp files are JSON-like, but
  // have trailing commas and include BigInt values)
  statSync: fs.statSync,
  existsSync: fs.existsSync,
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
  convertGms2FilesToJson,
};

