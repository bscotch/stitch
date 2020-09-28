import { YyScript } from "../../../types/Yy";
import { Gms2Storage } from "../../Gms2Storage";
import paths from "../../paths";
import type { ResourceType } from "../Gms2ResourceArray";
import { Gms2ResourceBase, Gms2ResourceBaseParameters } from "./Gms2ResourceBase";

export class Gms2Script extends Gms2ResourceBase {
  static myResourceType: ResourceType = "scripts";
  protected yyData!: YyScript; // Happens in the super() constructor

  constructor(...setup: Gms2ResourceBaseParameters) {
    super(Gms2Script.myResourceType,...setup);
  }

  protected createYyFile(){
    const yyData: YyScript = {
      name: this.name,
      tags: [],
      parent: Gms2Script.parentDefault,
      resourceVersion: "1.0",
      resourceType: "GMScript",
      isDnD:false,
      isCompatibility:false
    };
    this.storage.saveJson(this.yyPathAbsolute,yyData);
  }

  get codeFilePathAbsolute(){
    return paths.join(this.yyDirAbsolute,`${this.name}.gml`);
  }

  set code(code:string){
    this.storage.saveBlob(this.codeFilePathAbsolute,code);
  }

  get code(){
    return this.storage.loadBlob(this.codeFilePathAbsolute).toString();
  }

  static create(name:string,code:string,storage:Gms2Storage){
    const script = new Gms2Script(name,storage,true);
    script.code = code;
    return script;
  }

}
