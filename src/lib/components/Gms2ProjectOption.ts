import { YypOption } from "../../types/YypComponents";
import { Objectable } from "./Objectable";

export class Gms2ProjectOption extends Objectable {

  #name:string;
  #path:string

  constructor(option:YypOption){
    super();
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
