import { YypConfig } from "../../types/YypComponents";

export class Gms2ProjectConfig {

  #name:string;
  #children:Gms2ProjectConfig[];

  constructor(option:YypConfig){
    this.#name = option.name;
    this.#children = option.children.map(child=>new Gms2ProjectConfig(child));
  }

  get name(){ return this.#name; }
  get children(){ return [...this.#children]; }

  toObject(): YypConfig{
    return {
      name: this.#name,
      children: this.#children.map(child=>child.toObject())
    };
  }
}
