import { YyData } from "../../../types/Yy";
import type { ResourceType } from "../Gms2ResourceArray";
import { Gms2ResourceBase, Gms2ResourceBaseParameters } from "./Gms2ResourceBase";

export class Gms2Shader extends Gms2ResourceBase {

  protected yyData!: YyData; // Happens in the super() constructor
  static resourceRoot:ResourceType = "shaders";

  constructor(...setup: Gms2ResourceBaseParameters) {
    super(Gms2Shader.myResourceType,...setup);
  }
}
