import { YyData } from "../../../types/Yy";
import { Gms2ResourceBase } from "./Gms2ResourceBase";

export class Gms2Room extends Gms2ResourceBase {

  protected yyData!: YyData; // Happens in the super() constructor
  protected resourceRoot = "rooms" as const;

  constructor(...setup: ConstructorParameters<typeof Gms2ResourceBase>) {
    super(...setup);
  }
}
