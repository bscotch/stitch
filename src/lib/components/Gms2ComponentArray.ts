import { dehydrateArray, hydrateArray } from "../hydrate";

export class  Gms2ComponentArray <YypData,ComponentClass extends new (object:YypData)=>InstanceType<ComponentClass>&{dehydrated:YypData}> {

  #items: InstanceType<ComponentClass>[];
  #class: ComponentClass;

  constructor(data:YypData[],resourceClass: ComponentClass){
    this.#items = hydrateArray(data,resourceClass);
    this.#class = resourceClass;
  }

  /** Get shallow-copy array of all item instances */
  list(){
    return [...this.#items];
  }

  find(matchFunction: (item: InstanceType<ComponentClass>)=>any){
    return this.#items.find(matchFunction);
  }

  findByField(field:keyof InstanceType<ComponentClass>,value:any){
    return this.#items.find(item=>item[field]==value);
  }

  push(...items:InstanceType<ComponentClass>[]){
    this.#items.push(...items);
    return this.list();
  }

  addNew(data:YypData){
    this.push( new this.#class(data));
  }

  /**
   * Create a new component instance if one doesn't already exist
   * matching the given uniqueField:uniqueValue pair.
   */
  addIfNew(data:YypData,uniqueField:keyof InstanceType<ComponentClass>,uniqueFieldValue:any){
    const existing = this.findByField(uniqueField,uniqueFieldValue);
    if(!existing){
      this.addNew(data);
    }
  }

  get dehydrated(): YypData[] {
    return dehydrateArray(this.#items);
  }
}