import { dehydrateArray } from "../hydrate";
import { Gms2Resource } from "../components/Gms2Resource";
import { Gms2Sound } from "../components/resources/Gms2Sound";
import { YypResource } from "../../types/YypComponents";
import { Gms2PipelineError } from "../errors";
import { Gms2Storage } from "../Gms2Storage";

export class  Gms2ResourceArray {

  #items: Gms2ResourceSubclass[];

  constructor(data: YypResource[], private storage: Gms2Storage){
    this.#items = data.map(Gms2ResourceArray._hydrateResource);
  }

  get dehydrated(): YypResource[] {
    return dehydrateArray(this.#items);
  }

  filterByClass<subclass extends Gms2ResourceSubclassType>(resourceClass: subclass){
    return this.#items
      .filter(item=>(item instanceof resourceClass)) as InstanceType<subclass>[];
  }

  find<subclass extends Gms2ResourceSubclassType>(matchFunction: (item: Gms2ResourceSubclass)=>any, resourceClass: subclass){
    return this.filterByClass(resourceClass)
      .find(item=>matchFunction(item));
  }

  findByField<subclass extends Gms2ResourceSubclassType>(field:keyof Gms2ResourceSubclass,value:any, resourceClass: subclass){
    return this.find(item=>item[field]==value,resourceClass);
  }


  static get _resourceClassMap() {
    const classMap = {
      animcurves: Gms2Resource,    // ❌
      extensions: Gms2Resource,    // ❌
      fonts: Gms2Resource,         // ❌
      notes: Gms2Resource,         // ❌
      objects: Gms2Resource,       // ❌
      paths: Gms2Resource,         // ❌
      rooms: Gms2Resource,         // ❌
      scripts: Gms2Resource,       // ❌
      sequences: Gms2Resource,     // ❌
      shaders: Gms2Resource,       // ❌
      sounds: Gms2Sound,           // ✅
      sprites: Gms2Resource,       // ❌
      tilesets: Gms2Resource,      // ❌
      timelines: Gms2Resource,     // ❌
    } as const;
    return classMap;
  }

  static _hydrateResource(data: YypResource) {
    const resourceType = data.id.path.split('/')[0] as (keyof typeof Gms2ResourceArray._resourceClassMap);
    const subclass = Gms2ResourceArray
      ._resourceClassMap[resourceType];
    if (!subclass) {
      throw new Gms2PipelineError(
        `No constructor for resource ${resourceType} exists.`
      );
    }
    const resource = new subclass(data) as Gms2ResourceSubclass;
    return resource;

  }
}

export type Gms2ResourceSubclass = InstanceType<typeof Gms2ResourceArray._resourceClassMap[keyof typeof Gms2ResourceArray._resourceClassMap]>;
export type Gms2ResourceSubclassType = typeof Gms2ResourceArray._resourceClassMap[keyof typeof Gms2ResourceArray._resourceClassMap];
export type Gms2ResourceType = keyof typeof Gms2ResourceArray._resourceClassMap;
