import { YypConfig } from "../../types/YypComponents";
import { hydrateArray, dehydrateArray, dehydrate} from '../hydrate'
import { Gms2ProjectIncludedFile } from "./Gms2ProjectIncludedFile";

interface ConfigData extends Omit<YypConfig,'children'> {
  children:Gms2ProjectConfig[]
}

export class Gms2ProjectConfig {

  #data: ConfigData ;

  constructor(option:YypConfig){
    this.#data = {
      ...option,
      children: hydrateArray(option.children, Gms2ProjectConfig)
    };
  }

  dehydrate(): YypConfig{
    return {
      ...this.#data,
      children: dehydrateArray<YypConfig,Gms2ProjectConfig>(this.#data.children)
    };
  }
}
