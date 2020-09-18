import { dehydrateArray } from "../hydrate";
import { Gms2Resource } from "../components/Gms2Resource";
import { Gms2Sound } from "../components/resources/Gms2Sound";
import { YypResource } from "../../types/YypComponents";
import { Gms2PipelineError } from "../errors";
import { Gms2Storage } from "../Gms2Storage";
import paths from "../paths";
import { Gms2Sprite } from "./resources/Gms2Sprite";
import { difference, uniqBy } from "lodash";
import { logInfo } from "../log";
import { Gms2Script } from "./resources/Gms2Script";

export class  Gms2ResourceArray {

  private items: Gms2ResourceSubclass[];

  constructor(data: YypResource[], storage: Gms2Storage){
    const uniqueData = uniqBy(data,'id.name');
    const removedItems = difference(data,uniqueData);
    if(removedItems.length){
      logInfo(`Duplicate resources found: ${removedItems.length} duplicates removed`);
    }
    this.items = data.map(item=>Gms2ResourceArray.hydrateResource(item,storage));
  }

  get dehydrated(): YypResource[] {
    return dehydrateArray(this.items);
  }

  get sprites(){ return this.filterByClass(Gms2Sprite);}
  get sounds(){ return this.filterByClass(Gms2Sound); }
  get scripts(){ return this.filterByClass(Gms2Script);}

  filterByClass<subclass extends Gms2ResourceSubclassType>(resourceClass: subclass){
    return this.items
      .filter(item=>(item instanceof resourceClass)) as InstanceType<subclass>[];
  }

  filter(matchFunction:(item:Gms2Resource)=>any){
    return this.items.filter(matchFunction);
  }

  forEach(doSomething:(item:Gms2Resource)=>any){
    this.items.forEach(doSomething);
    return this;
  }

  find<subclass extends Gms2ResourceSubclassType>(matchFunction: (item: Gms2ResourceSubclass)=>any, resourceClass: subclass){
    return this.filterByClass(resourceClass)
      .find(item=>matchFunction(item));
  }

  findByField<subclass extends Gms2ResourceSubclassType>(field:keyof Gms2ResourceSubclass,value:any, resourceClass: subclass){
    return this.find(item=>item[field]==value,resourceClass);
  }

  /** Find all resources in a given folder */
  filterByFolder(folder:string,recursive=true){
    return this.items.filter(item=>item.isInFolder(folder,recursive));
  }

  /** Find all resources of a given type within a folder */
  filterByClassAndFolder<subclass extends Gms2ResourceSubclassType>(resourceClass:subclass,folder:string,recursive=true){
    return this.filterByFolder(folder,recursive)
      .filter(item=>(item instanceof resourceClass)) as InstanceType<subclass>[];
  }

  addSound(sourcePath:string,storage:Gms2Storage){
    const {name} = paths.parse(sourcePath);
    const existingSound = this.findByField('name',name,Gms2Sound);
    if(existingSound){
      existingSound.replaceAudioFile(sourcePath);
      return this;
    }
    else{
      return this.push(Gms2Sound.create(sourcePath,storage));
    }
  }

  addScript(name:string,code:string,storage:Gms2Storage){
    return this.push(Gms2Script.create(name,code,storage));
  }

  /**
   * Given Yyp data for a resource that **is not listed in the yyp file**
   * but that **does have .yy and associated files**, add hydrate the object
   * and add it to the Yyp.
   */
  register(data:YypResource,storage:Gms2Storage){
    this.items.push(Gms2ResourceArray.hydrateResource(data,storage));
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
      sprites: Gms2Sprite,         // ✅
      tilesets: Gms2Resource,      // ❌
      timelines: Gms2Resource,     // ❌
    } as const;
    return classMap;
  }

  static hydrateResource(data: YypResource, storage: Gms2Storage) {
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
