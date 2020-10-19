import {parse} from "../../lib/json";
import { YypIncludedFile } from "../../types/Yyp";
import { Gms2PipelineError } from "../errors";
import type { Gms2Project } from "../Gms2Project";
import { Gms2Storage } from "../Gms2Storage";
import paths from "../paths";
import { oneline } from "@bscotch/utility";

export class Gms2IncludedFile {

  private data: YypIncludedFile;

  constructor(option:YypIncludedFile,private storage:Gms2Storage){
    this.data = {...option};
  }

  get name(){ return this.data.name; }
  /** The directory containing this file, relative to project root  */
  get directoryRelative(){ return this.data.filePath; }
  get directoryAbsolute(){ return paths.join(this.storage.yypDirAbsolute,this.directoryRelative);}
  get filePathRelative(){
    return paths.join(this.directoryRelative,this.name);
  }
  get filePathAbsolute(){
    return paths.join(this.directoryAbsolute,this.name);
  }

  /** Get the file content */
  get contentAsBuffer():Buffer{
    return this.storage.readBlob(this.filePathAbsolute);
  }
  /**
   * Set the file content on disk. If string or Buffer,
   * just directly write. In all other cases, JSON stringify.
  */
  setContent(data:any){
    if(typeof data == 'string' || Buffer.isBuffer(data)){
      this.storage.writeBlob(this.filePathAbsolute,data);
    }
    else{
      this.storage.writeJson(this.filePathAbsolute,data);
    }
  }

  /** If the content is JSON, get it as a parsed Javascript structure (else throw) */
  get contentParsedAsJson(){
    return parse(this.contentAsString);
  }

  /** Get the file content as a string */
  get contentAsString(): string{
    return this.contentAsBuffer.toString();
  }

  /** The list of configurations that apply to this file in some way. */
  get configNames(){
    return Object.keys(this.data.ConfigValues ||{});
  }
  /** The configuration overrides for this file */
  get config(){
    return this.data.ConfigValues;
  }
  set config(configuration: {[configName:string]:{CopyToMask:string}}|undefined){
    this.data.ConfigValues = configuration;
  }

  /**
   * Replace this Included File's content with the content
   * from another file (names don't need to match)
   */
  replaceWithFileContent(sourceFile:string){
    this.storage.copyFile(sourceFile,this.filePathAbsolute);
  }

  isInModule(moduleName:string){
    return this.data.filePath.split('/')
      .map(folder=>folder.toLocaleLowerCase())
      .includes(moduleName.toLocaleLowerCase());
  }

  get dehydrated(): YypIncludedFile{
    return {...this.data};
  }

  static get defaultDataValues(): Omit<YypIncludedFile,'name'|'filePath'>{
    return {
      CopyToMask: -1,
      resourceType: "GMIncludedFile",
      resourceVersion: "1.0"
    };
  }

  static importFromDirectory(project:Gms2Project,path:string,subdirectory?:string, allowedExtensions?:string[]){
    if(!project.storage.isDirectory(path)){
      throw new Gms2PipelineError(`${path} is not a directory`);
    }
    const filePaths = project.storage.listFiles(path,true, allowedExtensions);

    const importedFiles: Gms2IncludedFile[] = [];
    for(const filePath of filePaths){
      // Use relative pathing to ensure that organization inside GMS2
      // matches original folder heirarchy, but all inside whatever 'subdirectory' was provided
      const filePathRelativeToStart = paths.relative(path,filePath);
      const relativeSubdirectory = paths.join(subdirectory||'NEW',paths.dirname(filePathRelativeToStart));
      importedFiles.push(Gms2IncludedFile.importFromFile(project,filePath,relativeSubdirectory));
    }
    return importedFiles;
  }

  static importFromFile(project:Gms2Project,path:string,subdirectory?:string){
    const blob = project.storage.readBlob(path);
    return Gms2IncludedFile.importFromData(project,path,blob,subdirectory);
  }

  static importFromData(project:Gms2Project,path:string,content:any,subdirectory?:string){
    if( [null,undefined].includes(content) ){
      throw new Gms2PipelineError(`IncludedFile import using data cannot have null/undefined as that data.`);
    }
    const fileName = paths.parse(path).base;
    // (Ensure POSIX-style seps)
    const directoryRelative = `datafiles/${paths.asPosixPath(subdirectory||'NEW')}`;

    // See if something already exists with project name
    const matchingFile = project.includedFiles.findByField('name',fileName);
    if(matchingFile){
      // If the file is in the SAME PLACE, then just replace the file contents
      // If it's in a different subdir, assume that something unintended is going on
      if(matchingFile.directoryRelative == directoryRelative){
        matchingFile.setContent(content);
      }
      else{
        throw new Gms2PipelineError(oneline`
          CONFLICT: A file by name ${fileName} already exists in a different subdirectory.
          If they are the same file, ensure they have the same subdirectory.
          If they are different files, rename one of them.
        `);
      }
      return matchingFile;
    }
    else{
      // This is a new file
      // Create the Yyp data and add to the project
      // Copy over the file
      const newIncludedFile = project.includedFiles.addNew({
        ...Gms2IncludedFile.defaultDataValues,
        name: fileName,
        filePath: directoryRelative
      });
      newIncludedFile.setContent(content);
      project.save();
      return newIncludedFile;
    }
  }


  static import(project:Gms2Project,path:string,content?:any,subdirectory?:string, allowedExtensions?: string[]){
    if( ! [null,undefined].includes(content) ){
      return [Gms2IncludedFile.importFromData(project,path,content,subdirectory)];
    }
    else if(! project.storage.exists(path)){
      throw new Gms2PipelineError(`Path ${path} does not exist and no alternate content provided.`);
    }
    else if(project.storage.isDirectory(path)){
      return Gms2IncludedFile.importFromDirectory(project,path,subdirectory, allowedExtensions);
    }
    else{
      return [Gms2IncludedFile.importFromFile(project,path,subdirectory)];
    }
  }
}
