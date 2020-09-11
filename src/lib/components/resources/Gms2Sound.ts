import { Gms2Resource } from "../Gms2Resource";
import { YypResource } from "../../../types/YypComponents";
import { Gms2ResourceType } from "../../../types/Gms2ProjectComponents";

export class Gms2Sound extends Gms2Resource {
  constructor(data: YypResource, type: Gms2ResourceType) {
    super(data, type);
  }
}
