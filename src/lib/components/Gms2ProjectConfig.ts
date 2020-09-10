import { YypConfig } from "../../types/YypComponents";
import { hydrateArray, dehydrateArray} from '../hydrate'

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
      children: dehydrateArray(this.#data.children)
    };
  }
}
