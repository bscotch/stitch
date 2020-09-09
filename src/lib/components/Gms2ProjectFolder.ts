import { YypFolder } from "../../types/YypComponents";
import { Objectable } from "./Objectable";

export class Gms2ProjectFolder extends Objectable {

  #name: string;
  #tags: string;
  #folderPath: string;
  #order: number;

  constructor(folder:YypFolder){
    super();
    this.#name = folder.name;
    this.#tags = folder.tags;
    this.#folderPath = folder.folderPath;
    this.#order = folder.order;
  }

  get name(){ return this.#name; }

  toObject(): YypFolder{
    return {
      name: this.#name,
      tags: this.#tags,
      folderPath: this.#folderPath,
      order: this.#order,
      resourceType: 'GMFolder',
      resourceVersion: '1.0'
    };
  }
}
