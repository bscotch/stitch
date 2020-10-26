
import JsonBig from "json-bigint";
import fs from "fs-extra";
import path from "path";
import { StitchError } from "./errors";
import sortKeys from "sort-keys";

const Json = JsonBig({ useNativeBigInt: true });

/**
 * Stringify JSON allowing Int64s. Will attempt
 * to get .dehydrated and use the return value of
 * that on every key:value pair, allowing control
 * over how class instances are stringified.
 */
export function stringify(stuff: any) {
  return Json.stringify(
    stuff,
    (key: string, value: any) => value?.dehydrated ?? value,
    "\t"
  );
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
  const sortedStuff = sortKeys(stuff);
  const stringifiedSortedStuff = stringify(sortedStuff);
  // Only write if necessary
  fs.ensureDirSync(path.dirname(filePath));
  if(fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()){
    throw new StitchError(`Cannot write file to ${filePath}; path is a directory`);
  }
  try{
    const existing = sortKeys(loadFromFileSync(filePath));
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
  fs.writeFileSync(filePath,stringifiedSortedStuff); // Swap back to this if untrue
}
