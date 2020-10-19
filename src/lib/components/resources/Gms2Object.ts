import { YyObject } from "../../../types/YyObject";
import { Gms2ResourceBase, Gms2ResourceBaseParameters } from "./Gms2ResourceBase";

export class Gms2Object extends Gms2ResourceBase {

  protected yyData!: YyObject; // Happens in the super() constructor

  constructor(...setup: Gms2ResourceBaseParameters) {
    super("objects",...setup);
  }

  /* This object's parent object. */
  get parentName(){
    return this.yyData.parentObjectId?.name;
  }
  /**
   * Set this object's parent object.
   * **WARNING** does not check if that object exists.
   */
  set parentName(name: string|undefined){
    this.yyData.parentObjectId = name
      ? {
        name,
        path: `objects/${name}/${name}.yy`
      }
      : null ;
    this.save();
  }

  get spriteName(){
    return this.yyData.spriteId?.name;
  }
  set spriteName(name: string|undefined){
    this.yyData.spriteId = name
      ? {
        name,
        path: `sprites/${name}/${name}.yy`
      }
      : null ;
    this.save();
  }
}
