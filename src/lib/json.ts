
import JsonBig from "json-bigint";
import fs from "fs-extra";
import path from "path";
import { StitchError } from "./errors";
import sortKeys from "sort-keys";

const Json = JsonBig({ useNativeBigInt: true });

/**
 * Stringify JSON allowing Int64s.
 */
export function stringify(stuff: any) {
  return Json.stringify(stuff,null,2);
}

/**
 * Parse JSON GMS2-style: allowing Int64s
 */
export function parse(string: string) {
  return Json.parse(string);
}

/**
 * Read GMS2-style JSON into an object
 */
export function loadFromFileSync(filePath: string) {
  let content = fs.readFileSync(filePath, 'utf8');
  // Strip trailing commas before parsing as JSON
  content = content.replace(/,(\s*[}\]])/g, "$1");
  try{
    return Json.parse(content);
  }
  catch{
    throw new StitchError(`Content of ${filePath} is not valid JSON.`);
  }
}

/**
 * Write GMS2-style JSON into an object
 */
export function writeFileSync(filePath: string, stuff: any) {
  // Only write if necessary
  fs.ensureDirSync(path.dirname(filePath));
  if(fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()){
    throw new StitchError(`Cannot write file to ${filePath}; path is a directory`);
  }
  try{
    // Stringification may differ, so check for being the same
    // after removing sorting and spacing differences.
    const existing = sortKeys(loadFromFileSync(filePath));
    const sortedStuff = sortKeys(stuff?.toJSON?.() ?? stuff);
    const stringifiedSortedStuff = stringify(sortedStuff);
    if(stringify(existing) == stringifiedSortedStuff){
      return;
    }
  }
  catch(err){
    if(!['ENOENT'].includes(err?.code)){
      throw err;
    }
  }
  // The GameMaker IDE may better handle live file changes
  // when files are deleted and replaced instead of written over.
  fs.writeFileSync(filePath,stringify(stuff)); // Swap back to this if untrue
}
