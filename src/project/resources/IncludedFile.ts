import {Resource} from './Resource';
import type {RawResource} from "../types/project";
import path from "path";
import {Project} from "../Project";
import {assert} from "../lib/messages";
import {v4 as uuidV4} from "uuid";
import cloneDeep from 'lodash/cloneDeep';
import fs from "fs-extra";
import {
  includedFileSample,
} from "./templates/datafile";
import {
  ensureWin32Path,
  ensurePosixPath
} from "../lib/path";

export class IncludedFile extends Resource{

  constructor(project:Project,resource:RawResource){
    super(project,resource,"GMIncludedFile");
  }

  get includedFilePath(){
    // The actual data file is stored in "datafiles" (instead of "datafiles_yy")
    // but otherwise with the same directory structure.
    return path.join(this.dir.replace("_yy",""),this.name);
  }

  get includedFileAbsolutePath(){
    return this.project.getAbsolutePath(this.includedFilePath);
  }

  get associatedFiles(){
    return [this.includedFileAbsolutePath];
  }

  replaceIncludedFile(sourceFilePath: string){
    assert(fs.existsSync(sourceFilePath),`${sourceFilePath} does not exist`);
    fs.ensureDirSync(path.dirname(this.includedFileAbsolutePath));
    fs.copySync(sourceFilePath, this.includedFileAbsolutePath);
    return this;
  }

  replaceIncludedFileContent(data: string|Buffer){
    if(this.project.locked){ return this; }
    fs.ensureDirSync(path.dirname(this.includedFileAbsolutePath));
    fs.writeFileSync(this.includedFileAbsolutePath,data);
    return this;
  }

  static createUsingBlob(project:Project,fileName:string,content:string|Buffer,subdirectory?:string){
    assert(project&&fileName&&content,"Arguments missing");
    const key = uuidV4();
    const yy = cloneDeep(includedFileSample);
    const subdirectories = [];
    if(subdirectory){
      subdirectories.push(...subdirectory.split(/[/\\]+/));
    }
    yy.id = key;
    yy.name = fileName;
    yy.fileName = fileName;
    // Actually the local directory
    yy.filePath = path.win32.join('datafiles',...subdirectories);
    // Write this thing's yy file
    const yyDir  = path.join('datafiles_yy',...subdirectories);
    const yyPath = path.join(yyDir,`${fileName}.yy`);
    fs.ensureDirSync(project.getAbsolutePath(yyDir));
    project.writeJSONSync(yyPath,yy);
    // Create the resource
    const includedFile = new IncludedFile(
      project,
      // e.g. datafiles_yy\\BscotchPack\\srcFile.yy
      Project.createYYPResource(key,'GMIncludedFile',ensureWin32Path(yyPath))
    );
    // Make sure that the view exists
    const view = project.ensureViewExists(ensurePosixPath(yy.filePath));
    view.addChild(includedFile,true);
    // Add the file
    includedFile.replaceIncludedFileContent(content);
    // Commit changes to the yyp file
    project.commit();
    return includedFile;
  }

  /** Create a new IncludedFile resource based on an external file.
   * By default will appear in "datafiles" root folder, but you can specificy
   * a subdirectory path.
   * @param subdirectory Subdirectory inside the Datafiles folder in which to place this resource.
   */
  static create(project:Project, sourceFilePath:string, subdirectory?:string){
    assert(project&&sourceFilePath,"Arguments missing");
    assert(fs.existsSync(sourceFilePath),`IncludedFile source does not exist: ${sourceFilePath}`);
    assert(fs.statSync(sourceFilePath).isFile(),`Source is not a file`);

    const name = IncludedFile.nameFromSource(sourceFilePath);
    return IncludedFile.createUsingBlob(project,name,fs.readFileSync(sourceFilePath),subdirectory);
  }

  static nameFromSource(source:string){
    return path.parse(source).base;
  }
}