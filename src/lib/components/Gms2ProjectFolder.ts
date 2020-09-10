import { YypFolder } from "../../types/YypComponents";

export class Gms2ProjectFolder {

  #data:YypFolder;

  constructor(folder:YypFolder){
    this.#data = {...folder};
  }

  toObject(): YypFolder{
    return {...this.#data};
  }
}
