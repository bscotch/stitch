import { YyData } from "../../../types/Yy";
import { Gms2ResourceBase, Gms2ResourceBaseParameters } from "./Gms2ResourceBase";
import type { ResourceType } from "../Gms2ResourceArray";

export class Gms2Tileset extends Gms2ResourceBase {
  static myResourceType: ResourceType = "tilesets";
  protected yyData!: YyData; // Happens in the super() constructor

  constructor(...setup: Gms2ResourceBaseParameters) {
    super(Gms2Tileset.myResourceType,...setup);
  }
}
