import { YyScript } from "../../../types/Yy";
import { Gms2Storage } from "../../Gms2Storage";
import paths from "../../paths";
import { Gms2ResourceBase } from "./Gms2ResourceBase";

export class Gms2Script extends Gms2ResourceBase {

  protected yyData!: YyScript; // Happens in the super() constructor

  constructor(...setup: ConstructorParameters<typeof Gms2ResourceBase>) {
    super(...setup);
  }

  createYyFile(){
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
    const script = new Gms2Script({id:{name,path:`scripts/${name}/${name}.yy`},order:1},storage,true);
    script.code = code;
    return script;
  }

}
