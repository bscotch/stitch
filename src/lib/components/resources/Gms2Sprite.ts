import { YypSprite } from "../../../types/Yy";
import { Gms2Resource } from "../Gms2Resource";

export class Gms2Sprite extends Gms2Resource {

  protected yyData!: YypSprite; // Happens in the super() constructor

  constructor(...setup: ConstructorParameters<typeof Gms2Resource>) {
    super(...setup);
  }

}
