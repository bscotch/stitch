import { YypResource } from "../../types/YypComponents";

export class Gms2Resource {

  #data: YypResource;

  constructor(option:YypResource){
    this.#data = {...option};
  }

  get dehydrated(): YypResource{
    return {...this.#data};
  }
}
