import fs from 'fs-extra';
import path from 'path';
import diff from 'diff';
import {diff as deepDiff} from 'deep-diff';
import difference from 'lodash/difference';
import intersection from 'lodash/intersection';
import md5File from 'md5-file';
import klaw from 'klaw-sync'; // highly unlikely that async needed
import json from "./lib/json";

function allFiles(dir:string, relative:boolean|null=true){
  const fullPaths = klaw(dir)
    .filter(o=>o.stats.isFile())
    .map(o=>o.path);
  if(relative){
    return fullPaths.map(f=>f.replace(path.join(path.resolve(dir),path.sep),''));
  }
  return dir;
}

/** Get an intelligent diff of two different Gamemaker projects.
 * For JSON files ignores file differences that don't impact the data.
 * @param  {string} firstProjectYYPPath - Path to the first project's YYP File
 * @param  {string} otherProjectYYPPath - Path to the other project's YYP File
 */
function projectDiff(firstProjectYYPPath:string, otherProjectYYPPath:string){
  for(const path of [firstProjectYYPPath,otherProjectYYPPath]){
    if(! fs.existsSync(path)){
      throw new Error(`Project file ${path} does not exist!`)
    }
    else if( !(/\.yyp$/).test(path)){
      throw new Error(`Project files end in ".yyp"!`);
    }
  }
  const firstDir = path.dirname(firstProjectYYPPath);
  const otherDir = path.dirname(otherProjectYYPPath)
  const firstFiles = allFiles(firstDir);
  const otherFiles = allFiles(otherDir);
  const deletedFiles = difference(firstFiles,otherFiles);
  const newFiles = difference(otherFiles,firstFiles);
  const commonFiles = intersection(firstFiles,otherFiles);
  const differences = [];
  for(const file of deletedFiles){
    differences.push({
      file,
      removed: true,
      diffType: 'removed'
    });
  }
  for(const file of newFiles){
    differences.push({
      file,
      added: true,
      diffType: 'added'
    });
  }
  for(const fileName of commonFiles){
    const firstFileName = path.join(firstDir,fileName);
    const otherFileName = path.join(otherDir,fileName);
    // Most of the time the files will be identical
    if(md5File.sync(firstFileName)==md5File.sync(otherFileName)){
      continue;
    }
    let changes: any = [];
    const firstFile = fs.readFileSync(firstFileName,'utf8');
    const otherFile = fs.readFileSync(otherFileName,'utf8');
    if(['.yyp','.yy','.json'].includes(path.extname(fileName))){
      // Compare as JSON
      changes = deepDiff(
        json.parse(firstFile),
        json.parse(otherFile));
    }
    else{
      // Compare by line
      changes = diff.diffTrimmedLines(firstFile,otherFile);
    }
    if(changes && changes.length){
      differences.push({
        file:fileName,
        diffType:'changed',
        changes
      });
    }

  }
  return differences;
}

export default projectDiff;