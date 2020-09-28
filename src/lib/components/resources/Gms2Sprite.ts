import { YySprite } from "../../../types/Yy";
import { Gms2ResourceBase, Gms2ResourceBaseParameters } from "./Gms2ResourceBase";
import type { ResourceType } from "../Gms2ResourceArray";

export class Gms2Sprite extends Gms2ResourceBase {

  protected yyData!: YySprite; // Happens in the super() constructor
  static myResourceType: ResourceType = "sprites";

  constructor(...setup: Gms2ResourceBaseParameters) {
    super(Gms2Sprite.myResourceType,...setup);
  }

  get textureGroup(){
    return this.yyData.textureGroupId.name;
  }

  set textureGroup(name:string){
    this.yyData.textureGroupId.name = name;
    this.yyData.textureGroupId.path = `texturegroups/${name}`;
    this.save();
  }
}
