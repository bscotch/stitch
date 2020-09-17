import { YyData } from "../../types/Yy";
//❌✅⌛❓

import { YypResource } from "../../types/YypComponents";
import { Gms2Storage } from "../Gms2Storage";
import paths from "../paths";
import path from "../paths";

export class Gms2Resource {

  protected data: YypResource;
  protected yyData: YyData;

  /**
   *  Create a resource using either the direct YYP-sourced object
   *  -or- the relative path to its yyp file (e.g. sounds/mySound/mySound.yyp)
   */
  constructor(data: YypResource | string, protected storage: Gms2Storage) {
    if(typeof data == 'string'){
      const {name} = path.parse(data);
      this.data = {id:{name,path:data},order:0};
    }
    else{
      this.data = {...data};
    }
    this.yyData = this.storage.readJson(this.yyPathAbsolute);
  }

  get name(){
    return this.yyData.name;
  }

  /** The folder containing this resource (as viewed via the IDE) */
  get folder(){
    return this.yyData.parent.path.replace(/^folders\/(.*).yy$/,"$1");
  }
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
