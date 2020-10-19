import { YyObject } from "../../../types/YyObject";
import { Gms2ResourceBase, Gms2ResourceBaseParameters } from "./Gms2ResourceBase";

export class Gms2Object extends Gms2ResourceBase {

  protected yyData!: YyObject; // Happens in the super() constructor

  constructor(...setup: Gms2ResourceBaseParameters) {
    super("objects",...setup);
  }

  /* This object's parent object. */
  get parent(){
    return this.yyData.parentObjectId?.name;
  }
  set parent(name: string|undefined){
    this.yyData.parentObjectId = name
      ? {
        name,
        path: `objects/${name}/${name}.yy`
      }
      : null ;
    this.save();
  }
}
