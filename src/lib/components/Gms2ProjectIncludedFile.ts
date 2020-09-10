import { YypInludedFiles } from "../../types/YypComponents";

export class Gms2ProjectIncludedFile {

  #data: YypInludedFiles;

  constructor(option:YypInludedFiles){
    this.#data = {...option};
  }

  dehydrate(): YypInludedFiles{
    return {...this.#data};
  }
}
