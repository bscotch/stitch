import { YypOption } from "../../types/Yyp";

export class Gms2Option {

  #data: YypOption;

  constructor(option:YypOption){
    this.#data = {...option};
  }

  toJSON(): YypOption{
    return {...this.#data};
  }
}
