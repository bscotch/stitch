//❌✅⌛❓

import { YypResource } from "../../types/YypComponents";
import { Gms2ResourceType } from "../components/Gms2ResourceArray";

export class Gms2Resource {

  #data: YypResource;
  #type: Gms2ResourceType;

  constructor(data: YypResource, type: Gms2ResourceType) {
    this.#data = { ...data };
    this.#type = type;
  }

  get dehydrated(): YypResource {
    return { ...this.#data };
  }
}
