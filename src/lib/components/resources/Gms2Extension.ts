import { YyData } from "../../../types/Yy";
import type { ResourceType } from "../Gms2ResourceArray";
import { Gms2ResourceBase, Gms2ResourceBaseParameters } from "./Gms2ResourceBase";

export class Gms2Extension extends Gms2ResourceBase {

  protected yyData!: YyData; // Happens in the super() constructor
  static resourceRoot: ResourceType = "extensions";

  constructor(...setup: Gms2ResourceBaseParameters) {
    super(Gms2Extension.myResourceType,...setup);
  }
}
