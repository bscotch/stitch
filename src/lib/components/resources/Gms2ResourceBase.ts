import { YyData } from "../../../types/Yy";
//❌✅⌛❓

import { YypResource } from "../../../types/YypComponents";
import { Gms2PipelineError } from "../../errors";
import { Gms2Storage } from "../../Gms2Storage";
import paths from "../../paths";
import path from "../../paths";
import type { ResourceType } from "../Gms2ResourceArray";

export type Gms2ResourceBaseParameters = [data: YypResource | string, storage: Gms2Storage, ensureYyFile?:boolean];

export class Gms2ResourceBase {

  protected data: YypResource;
  protected yyData: YyData;
  static  myResourceType: ResourceType;

  /**
   *  Create a resource using either the direct YYP-sourced object
   *  -or- the name of the resource
   */
  constructor(protected resourceRoot: ResourceType,data: YypResource | string, protected storage: Gms2Storage, ensureYyFile=false) {
    if(typeof data == 'string'){
      const name = data;
      this.data = {id:{name,path:`${this.resourceRoot}/${name}/${name}.yy`},order:0};
    }
    else{
      this.data = {...data};
    }
    if(!this.storage.exists(this.yyPathAbsolute)){
      if(!ensureYyFile){
        throw new Gms2PipelineError(`CONFLICT: Entry for ${this.data.id.name} in yyp does not have a .yy file.`);
      }
      // Create a default one!
      this.createYyFile();
    }
    this.yyData = this.storage.loadJson(this.yyPathAbsolute);
  }

  /** Create a generic Yy file, given YypData (must be implemented by each specifific resource.) */
  protected createYyFile(){
    throw new Gms2PipelineError(`createYyFile is not implemented on type ${this.resourceRoot}`);
  }

  get name(){
    return this.data.id.name;
  }

  /** The folder containing this resource (as viewed via the IDE) */
  get folder(){
    return this.yyData.parent.path.replace(/^folders\/(.*).yy$/,"$1");
  }
  /**
   * Set the parent folder for this resource. Note that you may
   * run into errors if this folder doesn't already exist.
   */
  set folder(folderName:string){
    this.yyData.parent.name = folderName;
    this.yyData.parent.path = `folders/${folderName}.yy`;
    this.save();
  }

  get resourceType(){
    return this.yyData.resourceType;
  }

  get yyDirRelative(){
    return path.dirname(this.yyPathRelative);
  }

  get yyDirAbsolute(){
    return path.dirname(this.yyPathAbsolute);
  }

  get yyPathRelative(){
    return this.data.id.path;
  }

  get yyPathAbsolute(){
    return path.join(this.storage.yypDirAbsolute,this.yyPathRelative);
  }

  /** The list of configurations that apply to this resource in some way. */
  get configNames(){
    return Object.keys(this.yyData.ConfigValues ||{});
  }

  /**
   * Return the paths of all files that collectively make up this
   * resource. In *all cases* that inclues a .yy file. The rest is
   * resourceType-specific.
  */
  get filePathsAbsolute(){
    return this.storage.listPaths(this.yyDirAbsolute);
  }

  get filePathsRelative(){
    return this.filePathsAbsolute.map(filePath=>paths.relative(paths.join(this.yyDirAbsolute,'..','..'),filePath));
  }

  /**
   * Check to see if this resource is in a given folder (recursively).
   * For example, for sprite 'sprites/menu/title/logo' both
   * 'sprites' and 'sprites/menu' would return `true`.
   */
  isInFolder(folderPath:string,recursive=true){
    folderPath = folderPath.replace(/\/$/,'');
    if(! this.folder.startsWith(folderPath) ){
      return false;
    }
    else if(this.folder == folderPath){
      return true;
    }
    else if(recursive && this.folder.replace(folderPath,'')[0]=='/'){
      // Then this.folder is a subdirectory of folderPath
      return true;
    }
    return false;
  }

  /**
   * Check to see if this resource is part of a module,
   * meaning that the module name exists as one of the subdirs
   * of its folder. For example, if this resource is in
   * sprites/BscotchPack/myPackOfSprites/... and you checked
   * for module "BscotchPack", you'd get TRUE.
   */
  isInModule(moduleName:string){
    return this.folder.split('/')
      .map(subdir=>subdir.toLocaleLowerCase())
      .includes(moduleName.toLocaleLowerCase());
  }

  /** Resources typically have one or more companion files
   * alongside their .yy file. They often have the same name
   * as the resource, but generally have different extension.
   * @param name If not provided, defaults to the resource's name
   */
  protected dataFilePathAbsolute(extension:string,name?:string){
    const basename = `${name || this.name}.${extension}`;
    return path.join(this.yyDirAbsolute,basename);
  }

  protected save(){
    // Save the YY data
    this.storage.saveJson(this.yyPathAbsolute,this.yyData);
  }

  get dehydrated(): YypResource {
    return { ...this.data };
  }

  static get parentDefault(){
    return {
      name: "NEW",
      path: "folders/NEW.yy",
    };
  }
}
