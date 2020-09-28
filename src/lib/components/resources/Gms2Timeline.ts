import { YyData } from "../../../types/Yy";
import type { ResourceType } from "../Gms2ResourceArray";
import { Gms2ResourceBase, Gms2ResourceBaseParameters } from "./Gms2ResourceBase";

export class Gms2Timeline extends Gms2ResourceBase {

  protected yyData!: YyData; // Happens in the super() constructor
  static myResourceType: ResourceType = "timelines";

  constructor(...setup: Gms2ResourceBaseParameters) {
    super(Gms2Timeline.myResourceType,...setup);
  }
}
