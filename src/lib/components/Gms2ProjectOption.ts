import { YypOption } from "../../types/YypComponents";

export class Gms2ProjectOption {

  #name:string;
  #path:string

  constructor(option:YypOption){
    this.#name = option.name;
    this.#path = option.path;
  }

  get name(){ return this.#name; }
  get path(){ return this.#path; }

  toObject(): YypOption{
    return {
      name: this.#name,
      path: this.#path
    };
  }
}
