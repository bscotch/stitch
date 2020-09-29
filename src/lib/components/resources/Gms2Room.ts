import { YyData } from "../../../types/Yy";
import { Gms2ResourceBase, Gms2ResourceBaseParameters } from "./Gms2ResourceBase";

export class Gms2Room extends Gms2ResourceBase {

  protected yyData!: YyData; // Happens in the super() constructor

  constructor(...setup: Gms2ResourceBaseParameters) {
    super("rooms",...setup);
  }
}
