import { YypConfig } from "../../types/YypComponents";
import { hydrateArray, dehydrateArray,} from '../hydrate';

interface ConfigData extends Omit<YypConfig,'children'> {
  children:Gms2Config[]
}

export class Gms2Config {

  #data: ConfigData ;

  constructor(option:YypConfig){
    this.#data = {
      ...option,
      children: hydrateArray(option.children, Gms2Config)
    };
  }

  get dehydrated(): YypConfig{
    return {
      ...this.#data,
      children: dehydrateArray(this.#data.children)
    };
  }
}
