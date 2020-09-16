import { YySprite } from "../../../types/Yy";
import { Gms2Resource } from "../Gms2Resource";

export class Gms2Sprite extends Gms2Resource {

  protected yyData!: YySprite; // Happens in the super() constructor

  constructor(...setup: ConstructorParameters<typeof Gms2Resource>) {
    super(...setup);
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
