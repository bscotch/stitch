import { YyData } from "../../../types/Yy";
import type { ResourceType } from "../Gms2ResourceArray";
import { Gms2ResourceBase, Gms2ResourceBaseParameters } from "./Gms2ResourceBase";

export class Gms2Room extends Gms2ResourceBase {

  protected yyData!: YyData; // Happens in the super() constructor
  static resourceRoot: ResourceType = "rooms";

  constructor(...setup: Gms2ResourceBaseParameters) {
    super(Gms2Room.myResourceType,...setup);
  }
}
