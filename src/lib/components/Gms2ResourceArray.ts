import { dehydrateArray } from "../hydrate";
import { Gms2Resource } from "../components/Gms2Resource";
import { Gms2Sound } from "../components/resources/Gms2Sound";
import { YypResource } from "../../types/YypComponents";
import { Gms2PipelineError } from "../errors";
import { Gms2Storage } from "../Gms2Storage";

export class  Gms2ResourceArray {

  private items: Gms2ResourceSubclass[];

  constructor(data: YypResource[], storage: Gms2Storage){
    this.items = data.map(item=>Gms2ResourceArray._hydrateResource(item,storage));
  }

  get dehydrated(): YypResource[] {
    return dehydrateArray(this.items);
  }

  filterByClass<subclass extends Gms2ResourceSubclassType>(resourceClass: subclass){
    return this.items
      .filter(item=>(item instanceof resourceClass)) as InstanceType<subclass>[];
  }

  find<subclass extends Gms2ResourceSubclassType>(matchFunction: (item: Gms2ResourceSubclass)=>any, resourceClass: subclass){
    return this.filterByClass(resourceClass)
      .find(item=>matchFunction(item));
  }

  findByField<subclass extends Gms2ResourceSubclassType>(field:keyof Gms2ResourceSubclass,value:any, resourceClass: subclass){
    return this.find(item=>item[field]==value,resourceClass);
  }

  upsertSound(sourcePath:string,storage:Gms2Storage){
    return this.push(Gms2Sound.create(sourcePath,storage));
  }

  private push(newResource: Gms2Resource){
    this.items.push(newResource);
    return this;
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

  static _hydrateResource(data: YypResource, storage: Gms2Storage) {
    const resourceType = data.id.path.split('/')[0] as (keyof typeof Gms2ResourceArray._resourceClassMap);
    const subclass = Gms2ResourceArray
      ._resourceClassMap[resourceType];
    if (!subclass) {
      throw new Gms2PipelineError(
        `No constructor for resource ${resourceType} exists.`
      );
    }
    const resource = new subclass(data,storage) as Gms2ResourceSubclass;
    return resource;

  }
}

export type Gms2ResourceSubclass = InstanceType<typeof Gms2ResourceArray._resourceClassMap[keyof typeof Gms2ResourceArray._resourceClassMap]>;
export type Gms2ResourceSubclassType = typeof Gms2ResourceArray._resourceClassMap[keyof typeof Gms2ResourceArray._resourceClassMap];
export type Gms2ResourceType = keyof typeof Gms2ResourceArray._resourceClassMap;
