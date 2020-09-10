import { YypOption } from "../../types/YypComponents";

export class Gms2ProjectOption {

  #data: YypOption;

  constructor(option:YypOption){
    this.#data = {...option};
  }

  toObject(): YypOption{
    return {...this.#data};
  }
}
