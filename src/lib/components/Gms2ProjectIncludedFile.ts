import { YypInludedFiles } from "../../types/YypComponents";

export class Gms2ProjectIncludedFile {

  #data: YypInludedFiles;

  constructor(option:YypInludedFiles){
    this.#data = {...option};
  }

  get dehydrated(): YypInludedFiles{
    return {...this.#data};
  }
}
