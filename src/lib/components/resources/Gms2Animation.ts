import { YyData } from "../../../types/Yy";
import type { ResourceType } from "../Gms2ResourceArray";
import { Gms2ResourceBase, Gms2ResourceBaseParameters } from "./Gms2ResourceBase";

export class Gms2Animation extends Gms2ResourceBase {

  protected yyData!: YyData; // Happens in the super() constructor
  static resourceRoot: ResourceType = "animcurves";

  constructor(...setup: Gms2ResourceBaseParameters) {
    super(Gms2Animation.myResourceType,...setup);
  }
}
