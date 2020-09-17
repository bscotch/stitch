import { difference, uniqBy } from "lodash";
import {stringify} from "../../lib/json";
import { Gms2Storage } from "../Gms2Storage";
import { dehydrateArray } from "../hydrate";
import { logInfo } from "../log";

export abstract class Gms2ComponentArrayBase
<
  YypData,
  ComponentClass extends
  (new (object:YypData)=>InstanceType<ComponentClass>&{dehydrated:YypData}) |
  (new (object:YypData,storage:Gms2Storage)=>InstanceType<ComponentClass>&{dehydrated:YypData})
> {

  protected items: InstanceType<ComponentClass>[] = [];

  /** Get shallow-copy array of all item instances */
  list(){
    return [...this.items];
  }

  find(matchFunction: (item: InstanceType<ComponentClass>)=>any){
    return this.items.find(matchFunction);
  }

  findByField(field:keyof InstanceType<ComponentClass>,value:any){
    return this.items.find(item=>item[field]==value);
  }

  push(...items:InstanceType<ComponentClass>[]){
    this.items.push(...items);
    return this;
  }

  abstract addNew(data:YypData):ComponentClass;

  /**
   * Create a new component instance if one doesn't already exist
   * matching the given uniqueField:uniqueValue pair.
   */
  addIfNew(data:YypData,uniqueField:keyof InstanceType<ComponentClass>,uniqueFieldValue:any){
    const existing = this.findByField(uniqueField,uniqueFieldValue);
    if(!existing){
      return this.addNew(data);
    }
    return false;
  }

  get dehydrated(): YypData[] {
    return dehydrateArray(this.items);
  }

  uniqueYypDataEntries(data:YypData[]){
    const uniqueData = uniqBy(data,stringify);
    const removedItems = difference(data,uniqueData);
    if(removedItems.length){
      logInfo(`Duplicate entries found: ${removedItems.length} duplicates removed`);
    }
    return uniqueData;
  }
}