import { dehydrateArray } from "../hydrate";
import { Gms2ResourceBase } from "./resources/Gms2ResourceBase";
import { Gms2Sound } from "../components/resources/Gms2Sound";
import { YypResource } from "../../types/YypComponents";
import { Gms2PipelineError } from "../errors";
import { Gms2Storage } from "../Gms2Storage";
import paths from "../paths";
import { Gms2Sprite } from "./resources/Gms2Sprite";
import { difference, uniqBy } from "lodash";
import { logInfo } from "../log";
import { Gms2Script } from "./resources/Gms2Script";
import { Gms2Animation } from "./resources/Gms2Animation";
import { Gms2Extension } from "./resources/Gms2Extension";
import { Gms2Font } from "./resources/Gms2Font";
import { Gms2Note } from "./resources/Gms2Note";
import { Gms2Object } from "./resources/Gms2Object";
import { Gms2Path } from "./resources/Gms2Path";
import { Gms2Room } from "./resources/Gms2Room";
import { Gms2Sequence } from "./resources/Gms2Sequence";
import { Gms2Shader } from "./resources/Gms2Shader";
import { Gms2Tileset } from "./resources/Gms2Tileset";
import { Gms2Timeline } from "./resources/Gms2Timeline";

export class  Gms2ResourceArray {

  private items: Gms2ResourceSubclass[];

  constructor(data: YypResource[], private storage: Gms2Storage){
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
  get all(){ return [...this.items]; }

  filterByClass<subclass extends Gms2ResourceSubclassType>(resourceClass: subclass){
    return this.items
      .filter(item=>(item instanceof resourceClass)) as InstanceType<subclass>[];
  }

  filter(matchFunction:(item:Gms2ResourceBase)=>any){
    return this.items.filter(matchFunction);
  }

  forEach(doSomething:(item:Gms2ResourceBase)=>any){
    this.items.forEach(doSomething);
    return this;
  }

  find<subclass extends Gms2ResourceSubclassType>(matchFunction: (item: Gms2ResourceSubclass)=>any, resourceClass: subclass){
    return this.filterByClass(resourceClass)
      .find(item=>matchFunction(item));
  }

  findByName<subclass extends Gms2ResourceSubclassType>(name:any, resourceClass?: subclass){
    const item = this.items.find(i=>i.name==name);
    if(item && resourceClass && !(item instanceof resourceClass)){
      return;
    }
    return item;
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
    const script = this.findByField('name',name,Gms2Script);
    if(script){
      script.code = code;
      return this;
    }
    else{
      return this.push(Gms2Script.create(name,code,storage));
    }
  }

  /**
   * Delete a resource, if it exists. **NOTE:** if other
   * resources depend on this one you'll be creating errors
   * by deleting it!
   */
  deleteByName(name:string){
    const resourceIdx = this.items.findIndex(i=>i.name==name);
    if(resourceIdx<0){
      return this;
    }
    const [resource] = this.items.splice(resourceIdx,1);
    this.storage.emptyDir(resource.yyDirAbsolute);
    return this;
  }

  /**
   * Given Yyp data for a resource that **is not listed in the yyp file**
   * but that **does have .yy and associated files**, add hydrate the object
   * and add it to the Yyp.
   */
  register(data:YypResource,storage:Gms2Storage){
    this.items.push(Gms2ResourceArray.hydrateResource(data,storage));
  }

  private push(newResource: Gms2ResourceBase){
    this.items.push(newResource);
    return this;
  }

  static get _resourceClassMap() {
    const classMap = {
      animcurves: Gms2Animation,
      extensions: Gms2Extension,
      fonts: Gms2Font,
      notes: Gms2Note,
      objects: Gms2Object,
      paths: Gms2Path,
      rooms: Gms2Room,
      scripts: Gms2Script,
      sequences: Gms2Sequence,
      shaders: Gms2Shader,
      sounds: Gms2Sound,
      sprites: Gms2Sprite,
      tilesets: Gms2Tileset,
      timelines: Gms2Timeline,
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

export type Gms2ResourceSubclassType = typeof Gms2ResourceArray._resourceClassMap[keyof typeof Gms2ResourceArray._resourceClassMap] | typeof Gms2ResourceBase;
export type Gms2ResourceSubclass = InstanceType<Gms2ResourceSubclassType>;
export type Gms2ResourceType = keyof typeof Gms2ResourceArray._resourceClassMap;
