//❌✅⌛❓

import { YypResource } from "../../types/YypComponents";

export class Gms2Resource {

  #data: YypResource;

  constructor(data: YypResource) {
    this.#data = { ...data };
  }

  get dehydrated(): YypResource {
    return { ...this.#data };
  }
}
