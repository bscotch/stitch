import { YypOption } from "../../types/YypComponents";

export class Gms2ProjectOption {

  #data: YypOption;

  constructor(option:YypOption){
    this.#data = {...option};
  }

  get dehydrated(): YypOption{
    return {...this.#data};
  }
}
