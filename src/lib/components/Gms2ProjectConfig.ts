import { YypConfig } from "../../types/YypComponents";

interface ConfigData extends Omit<YypConfig,'children'> {
  children:Gms2ProjectConfig[]
}

export class Gms2ProjectConfig {

  #data: ConfigData ;

  constructor(option:YypConfig){
    this.#data = {
      ...option,
      children: option.children.map(child=>new Gms2ProjectConfig(child))
    };
  }

  toObject(): YypConfig{
    return {
      ...this.#data,
      children: this.#data.children.map(child=>child.toObject())
    };
  }
}
