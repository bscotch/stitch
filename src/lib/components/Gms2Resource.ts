import { YyData } from "../../types/Yy";
//❌✅⌛❓

import { YypResource } from "../../types/YypComponents";
import { Gms2Storage } from "../Gms2Storage";
import path from "../paths";

export class Gms2Resource {

  #data: YypResource;
  #yyData: YyData;

  constructor(data: YypResource, protected storage: Gms2Storage) {
    this.#data = { ...data };
    this.#yyData = this.storage.readJson(this.yyPathAbsolute);
  }

  get name(){
    return this.#yyData.name;
  }

  get yyDirRelative(){
    return path.dirname(this.yyPathRelative);
  }

  get yyDirAbsolute(){
    return path.dirname(this.yyPathAbsolute);
  }

  get yyPathRelative(){
    return this.#data.id.path;
  }

  get yyPathAbsolute(){
    return path.join(this.storage.yypDirAbsolutePath,this.yyPathRelative);
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

  private save(){
    // Save the YY data
    this.storage.saveJson(this.yyPathAbsolute,this.#yyData);
  }

  get dehydrated(): YypResource {
    return { ...this.#data };
  }
}
