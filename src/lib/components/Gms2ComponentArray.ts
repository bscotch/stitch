import { dehydrateArray, hydrateArray } from "../hydrate";

export class  Gms2ComponentArray <YypData,ResourceClass extends new (object:YypData)=>InstanceType<ResourceClass>&{dehydrated:YypData}> {

  #items: InstanceType<ResourceClass>[];

  constructor(data:YypData[],resourceClass: ResourceClass){
    this.#items = hydrateArray(data,resourceClass);
  }

  /** Get shallow-copy array of all item instances */
  list(){
    return [...this.#items];
  }

  find(matchFunction: (item: InstanceType<ResourceClass>)=>any){
    return this.#items.find(matchFunction);
  }

  push(...items:InstanceType<ResourceClass>[]){
    this.#items.push(...items);
    return this.list();
  }

  get dehydrated(): YypData[] {
    return dehydrateArray(this.#items);
  }
}