import { hydrateArray } from "../hydrate";
import {Gms2ComponentArrayBase} from "./Gms2ComponentArrayBase";

export class Gms2ComponentArray<
  YypData,
  ComponentClass extends
  (new (object:YypData)=>InstanceType<ComponentClass>&{toJSON:()=>YypData})
> extends Gms2ComponentArrayBase<YypData,ComponentClass>{

  constructor(data:YypData[],private componentClass: ComponentClass){
    super();
    // Remove duplicates
    this.items = hydrateArray(this.uniqueYypDataEntries(data),this.componentClass);
  }

  addNew(data:YypData){
    const newComponent = new this.componentClass(data);
    this.push(newComponent);
    return newComponent;
  }
}