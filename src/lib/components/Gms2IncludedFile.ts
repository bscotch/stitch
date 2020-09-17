import { match } from "assert";
import { YypIncludedFile } from "../../types/YypComponents";
import { assert, Gms2PipelineError } from "../errors";
import type { Gms2Project } from "../Gms2Project";
import { Gms2Storage } from "../Gms2Storage";
import paths from "../paths";
import { oneline } from "../strings";

export class Gms2IncludedFile {

  #data: YypIncludedFile;

  constructor(option:YypIncludedFile,private storage:Gms2Storage){
    this.#data = {...option};
  }

  get name(){ return this.#data.name; }
  /** The directory containing this file, relative to project root  */
  get directoryRelative(){ return this.#data.filePath; }
  get directoryAbsolute(){ return paths.join(this.storage.yypDirAbsolute,this.directoryRelative);}
  get filePathRelative(){
    return paths.join(this.directoryRelative,this.name);
  }
  get filePathAbsolute(){
    return paths.join(this.directoryAbsolute,this.name);
  }

  /** Get the file content */
  get content(){
    return this.storage.readBlob(this.filePathAbsolute);
  }
  set content(blob:Buffer|string){
    this.storage.saveBlob(this.filePathAbsolute,blob);
  }

  /**
   * Replace this Included File's content with the content
   * from another file (names don't need to match)
   */
  replaceContent(sourceFile:string){
    this.storage.copyFile(sourceFile,this.filePathAbsolute);
  }

  get dehydrated(): YypIncludedFile{
    return {...this.#data};
  }


  static get defaultDataValues(): Omit<YypIncludedFile,'name'|'filePath'>{
    return {
      CopyToMask: -1,
      resourceType: "GMIncludedFile",
      resourceVersion: "1.0"
    };
  }

  static importFromDirectory(project:Gms2Project,path:string,subdirectory?:string){
    if(!project.storage.isDirectory(path)){
      throw new Gms2PipelineError(`${path} is not a directory`);
    }
    const filePaths = project.storage.listFiles(path,true);
    for(const filePath of filePaths){
      // Use relative pathing to ensure that organization inside GMS2
      // matches original folder heirarchy, but all inside whatever 'subdirectory' was provided
      const filePathRelativeToStart = paths.relative(path,filePath);
      const relativeSubdirectory = paths.join(subdirectory||'.',paths.dirname(filePathRelativeToStart));
      Gms2IncludedFile.importFromFile(project,filePath,relativeSubdirectory);
    }
    return;
  }

  static importFromFile(project:Gms2Project,path:string,subdirectory?:string){

    const fileName = paths.parse(path).base;
    // (Ensure POSIX-style seps)
    const directoryRelative = `datafiles/${paths.asPosixPath(subdirectory||'.')}`;

    // See if something already exists with project name
    const matchingFile = project.includedFiles.findByField('name',fileName);
    if(matchingFile){
      // If the file is in the SAME PLACE, then just replace the file contents
      // If it's in a different subdir, assume that something unintended is going on
      if(matchingFile.directoryRelative == directoryRelative){
        matchingFile.replaceContent(path);
      }
      else{
        throw new Gms2PipelineError(oneline`
          CONFLICT: A file by name ${fileName} already exists in a different subdirectory.
          If they are the same file, ensure they have the same subdirectory.
          If they are different files, rename one of them.
        `);
      }
    }
    else{
      // This is a new file
      // Create the Yyp data and add to the project
      // Copy over the file
      project.includedFiles.addNew({
        ...Gms2IncludedFile.defaultDataValues,
        name: fileName,
        filePath: directoryRelative
      }).replaceContent(path);
      project.save();
    }

    return project;
  }


  static import(project:Gms2Project,path:string,subdirectory?:string){
    assert(project.storage.exists(path),`File ${path} does not exist.`);

    // Handle files if the initial path is a directory
    if(project.storage.isDirectory(path)){
      Gms2IncludedFile.importFromDirectory(project,path,subdirectory);
    }
    else{
      Gms2IncludedFile.importFromFile(project,path,subdirectory);
    }

    // const added = this.components.IncludedFiles.addIfNew({
    //   ...Gms2IncludedFile.defaultDataValues,
    //   name: fileName,
    //   filePath: directoryRelative
    // },'name',fileName);

    // const fileName = IncludedFile.nameFromSource(path);
    // const existingResource = this.includedFiles.find(includedFile=>includedFile.name==fileName);
    // if(existingResource){
    //   return existingResource.replaceIncludedFile(path);
    // }
    // else{
    //   return IncludedFile.create(this,path,subdirectory);
    // }
  }
}
