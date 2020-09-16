import { dehydrateArray, hydrateArray } from "../hydrate";

export class  Gms2ComponentArray <YypData,ComponentClass extends new (object:YypData)=>InstanceType<ComponentClass>&{dehydrated:YypData}> {

  protected items: InstanceType<ComponentClass>[];
  private componentClass: ComponentClass;

  constructor(data:YypData[],resourceClass: ComponentClass){
    this.items = hydrateArray(data,resourceClass);
    this.componentClass = resourceClass;
  }

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

  addNew(data:YypData){
    this.push( new this.componentClass(data));
    return this;
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
    return this;
  }

  get dehydrated(): YypData[] {
    return dehydrateArray(this.items);
  }
}