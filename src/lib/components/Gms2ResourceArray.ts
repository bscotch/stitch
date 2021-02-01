import { dehydrateArray } from "../hydrate";
import { Gms2ResourceBase } from "./resources/Gms2ResourceBase";
import { Gms2Sound } from "../components/resources/Gms2Sound";
import { YypResource } from "../../types/Yyp";
import { assert, StitchError } from "../errors";
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
import { Spine } from "../../types/Spine";
import { oneline } from "@bscotch/utility";
import { uuidV4 } from "../uuid";
import { copyFile } from "fs-extra";

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

  toJSON(): YypResource[] {
    return dehydrateArray(this.items);
  }

  get sprites(){ return this.filterByClass(Gms2Sprite);}
  get sounds (){ return this.filterByClass(Gms2Sound );}
  get scripts(){ return this.filterByClass(Gms2Script);}
  get objects(){ return this.filterByClass(Gms2Object);}
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

  find(matchFunction: (item: Gms2ResourceSubclass)=>any){
    return this.items.find(item=>matchFunction(item));
  }

  findByClass<subclass extends Gms2ResourceSubclassType>(matchFunction: (item: Gms2ResourceSubclass)=>any, resourceClass: subclass){
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
    return this.findByClass(item=>item[field]==value,resourceClass);
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

  addSound(source:string,storage:Gms2Storage){
    const {name} = paths.parse(source);
    const existingSound = this.findByField('name',name,Gms2Sound);
    if(existingSound){
      existingSound.replaceAudioFile(source);
      logInfo(`updated sound ${name}`);
    }
    else{
      this.push(Gms2Sound.create(source,storage));
      logInfo(`created sound ${name}`);
    }
    return this;
  }

  addScript(name:string,code:string,storage:Gms2Storage){
    const script = this.findByField('name',name,Gms2Script);
    if(script){
      script.code = code;
      logInfo(`updated script ${name}`);
    }
    else{
      this.push(Gms2Script.create(name,code,storage));
      logInfo(`created script ${name}`);
    }
    return this;
  }

  addSprite(sourceFolder:string,storage:Gms2Storage,nameOverride?:string){
    const name = nameOverride || paths.basename(sourceFolder);
    const sprite = this.findByField('name',name,Gms2Sprite);
    if(sprite){
      sprite.replaceFrames(sourceFolder);
      logInfo(`updated sprite ${name}`);
    }
    else{
      this.push(Gms2Sprite.create(sourceFolder,storage,name));
      logInfo(`created sprite ${name}`);
    }
    return this;
  }

  addSpineSprite(jsonSourcePath:string,storage:Gms2Storage,nameOverride?:string){
    const sourceSpineName = paths.parse(jsonSourcePath).name;
    const name = nameOverride || sourceSpineName;

    const defaultSpriteImagePath = paths
      .join(__dirname,"..","..","..","assets","sprite-default.png");

    // Make sure the JSON file is a valid export.
    try{
      const jsonContent: Spine = storage.readJson(jsonSourcePath);
      assert(jsonContent.skeleton.spine,"The target JSON file is not from Spine.");
      assert(jsonContent.skeleton.spine.startsWith('3.7.'),
        "GameMaker Studio 2.3 is only compatible with Spine 3.7.X");
    }
    catch(err){
      throw err instanceof StitchError
        ? err
        : new StitchError(`There is no valid Spine JSON file at ${jsonSourcePath}.`);
    }

    // Make sure we have image and atlas files
    const sourcePathWithoutExt = paths.join(paths.dirname(jsonSourcePath),sourceSpineName);
    for(const ext of ['png','atlas']){
      const expectedSpineFilePath = `${sourcePathWithoutExt}.${ext}`;
      assert(storage.exists(expectedSpineFilePath),
        `File ${expectedSpineFilePath} does not exist.`);
    }

    let spineId = uuidV4(); // Will need one if sprite doesn't exist
    let sprite = this.findByField('name',name,Gms2Sprite);
    if(!sprite){
      // Use the default sprite from the shipped assets.
      // It doesn't actually matter what this asset is,
      // as GameMaker requires a regular sprite in order
      // to make use of the Spine files.
      const defaultSpritePath = paths.dirname(defaultSpriteImagePath);
      sprite = Gms2Sprite.create(defaultSpritePath,storage,name) as Gms2Sprite;
      this.push(sprite);
    }
    else{
      // Get the spine ID (if one exists). The only place it lives is in the
      // names of the files! Check the .atlas file.
      const atlasFile = sprite.filePathsRelative
        .find(file=>file.endsWith('.atlas'));
      spineId = atlasFile ? paths.parse(atlasFile).name : spineId;
    }

    // Whether we are creating or updating the outcome is the same.
    // We need to write/clobber to appropriate filenames, and since
    // Spine assets are not referenced in any Gamemaker project files
    // that's all that has to happen!
    const createDestPath = (name:string,ext:string)=>{
      return paths.join((sprite as Gms2Sprite).yyDirAbsolute,`${name}.${ext}`);
    };

    const atlasSourcePath = `${sourcePathWithoutExt}.atlas`;
    const spriteSheetSourcePath = `${sourcePathWithoutExt}.png`;

    const atlasDestPath = createDestPath(spineId,'atlas');
    const jsonDestPath  = createDestPath(spineId,'json');
    const spriteSheetDestPath = createDestPath(sourceSpineName,'png');

    // Also need a thumbnail. Just use the template image.
    const thumbnailDestPath = createDestPath(spineId,'png');

    const copyPaths: [string,string][] = [
      [atlasSourcePath, atlasDestPath],
      [jsonSourcePath, jsonDestPath],
      [spriteSheetSourcePath, spriteSheetDestPath],
      [defaultSpriteImagePath, thumbnailDestPath]
    ];
    copyPaths.forEach(storage.copyFile);

    logInfo(`updated spine sprite ${name}`);
    return this;
  }

  addObject(name:string,storage:Gms2Storage){
    const object = this.findByField('name',name,Gms2Object);
    if(!object){
      this.push(Gms2Object.create(name,storage));
      logInfo(`created object ${name}`);
    }
    else{
      logInfo(`object ${name} already exists`);
    }
    return this;
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

  static get resourceClassMap() {
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
    const resourceType = data.id.path.split('/')[0] as Gms2ResourceType;
    // const subclass = Gms2Timeline;
    const subclass = Gms2ResourceArray
      .resourceClassMap[resourceType];
    if (!subclass) {
      throw new StitchError(
        `No constructor for resource ${resourceType} exists.`
      );
    }
    const resource = new subclass(data,storage) as Gms2ResourceSubclass;
    return resource;

  }
}

export type Gms2ResourceSubclassType = typeof Gms2ResourceArray.resourceClassMap[keyof typeof Gms2ResourceArray.resourceClassMap] | typeof Gms2ResourceBase;
export type Gms2ResourceSubclass = InstanceType<Gms2ResourceSubclassType>;
export type Gms2ResourceType = keyof typeof Gms2ResourceArray.resourceClassMap;
