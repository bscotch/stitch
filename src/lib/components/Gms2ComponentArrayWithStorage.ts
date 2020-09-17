import { Gms2Storage } from "../Gms2Storage";
import { hydrateArray } from "../hydrate";
import {Gms2ComponentArrayBase} from "./Gms2ComponentArrayBase";

export class Gms2ComponentArrayWithStorage<
  YypData,
  ComponentClass extends
  (new (object:YypData,storage:Gms2Storage)=>InstanceType<ComponentClass>&{dehydrated:YypData})
> extends Gms2ComponentArrayBase<YypData,ComponentClass>{

  constructor(data:YypData[],private componentClass: ComponentClass,private storage:Gms2Storage){
    super();
    // Remove duplicates
    this.items = hydrateArray(this.uniqueYypDataEntries(data),this.componentClass,this.storage);
  }

  addNew(data:YypData){
    const newInstance = new this.componentClass(data,this.storage);
    this.push(newInstance);
    return newInstance;
  }
}