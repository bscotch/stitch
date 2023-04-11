import { pathy } from '@bscotch/pathy';
import { YypResource } from '@bscotch/yy';
import { difference, uniqBy } from 'lodash-es';
import { Spine } from '../../types/Spine.js';
import { StitchError } from '../../utility/errors.js';
import { debug, info, warn } from '../../utility/log.js';
import paths from '../../utility/paths.js';
import { dehydrateArray } from '../hydrate.js';
import type { StitchProject, StitchProjectComms } from '../StitchProject.js';
import { Gms2Animation } from './resources/Gms2Animation.js';
import { Gms2Extension } from './resources/Gms2Extension.js';
import { Gms2Font } from './resources/Gms2Font.js';
import { Gms2Note } from './resources/Gms2Note.js';
import { Gms2Object } from './resources/Gms2Object.js';
import { Gms2Particle } from './resources/Gms2Particle.js';
import { Gms2Path } from './resources/Gms2Path.js';
import { Gms2ResourceBase } from './resources/Gms2ResourceBase.js';
import { Gms2Room } from './resources/Gms2Room.js';
import { Gms2Script } from './resources/Gms2Script.js';
import { Gms2Sequence } from './resources/Gms2Sequence.js';
import { Gms2Shader } from './resources/Gms2Shader.js';
import { Gms2Sound } from './resources/Gms2Sound.js';
import { Gms2Sprite } from './resources/Gms2Sprite.js';
import { Gms2Tileset } from './resources/Gms2Tileset.js';
import { Gms2Timeline } from './resources/Gms2Timeline.js';

export class Gms2ResourceArray {
  private items: Gms2ResourceSubclass[];

  constructor(readonly project: StitchProject, data: YypResource[]) {
    const uniqueData = uniqBy(data, 'id.name');
    const removedItems = difference(data, uniqueData);
    if (removedItems.length) {
      warn(
        `Duplicate resources found: ${removedItems.length} duplicates removed`,
      );
    }
    this.items = data.map((item) =>
      Gms2ResourceArray.hydrateResource(item, project.io),
    );
  }

  toJSON(): YypResource[] {
    return dehydrateArray(this.items);
  }

  get sprites() {
    return this.filterByClass(Gms2Sprite);
  }
  get sounds() {
    return this.filterByClass(Gms2Sound);
  }
  get scripts() {
    return this.filterByClass(Gms2Script);
  }
  get objects() {
    return this.filterByClass(Gms2Object);
  }
  get rooms() {
    return this.filterByClass(Gms2Room);
  }
  get all() {
    return [...this.items];
  }

  filterByClass<subclass extends Gms2ResourceSubclassType>(
    resourceClass: subclass,
  ) {
    return this.items.filter(
      (item) => item instanceof resourceClass,
    ) as InstanceType<subclass>[];
  }

  filter(matchFunction: (item: Gms2ResourceBase) => any) {
    return this.items.filter(matchFunction);
  }

  forEach(doSomething: (item: Gms2ResourceBase) => any) {
    this.items.forEach(doSomething);
    return this;
  }

  find(matchFunction: (item: Gms2ResourceSubclass) => any) {
    return this.items.find((item) => matchFunction(item));
  }

  findByClass<subclass extends Gms2ResourceSubclassType>(
    matchFunction: (item: Gms2ResourceSubclass) => any,
    resourceClass: subclass,
  ) {
    return this.find((item) => {
      if (item instanceof resourceClass) {
        return matchFunction(item);
      }
      return false;
    }) as InstanceType<subclass> | undefined;
  }

  findByName<subclass extends Gms2ResourceSubclassType>(
    name: string,
    resourceClass: subclass,
  ): InstanceType<subclass> | undefined;
  findByName<subclass extends Gms2ResourceSubclassType>(
    name: string,
  ): InstanceType<subclass> | undefined;
  findByName(name: any): Gms2ResourceSubclass | undefined;
  findByName<subclass extends Gms2ResourceSubclassType>(
    name: string,
    resourceClass?: subclass,
  ): InstanceType<subclass> | undefined {
    const item = this.items.find((i) => {
      if (resourceClass && !(i instanceof resourceClass)) {
        return false;
      }
      const isMatch = i.isNamed(name);
      if (isMatch && !isMatch.isExactMatch) {
        throw new StitchError(
          `Resource names must always match case: found ${i.name} when looking for ${name}`,
        );
      }
      return isMatch;
    });
    return item as InstanceType<subclass> | undefined;
  }

  findByField<subclass extends Gms2ResourceSubclassType>(
    field: keyof Gms2ResourceSubclass,
    value: any,
    resourceClass: subclass,
  ) {
    return this.findByClass((item) => item[field] == value, resourceClass);
  }

  /** Find all resources in a given folder */
  filterByFolder(folder: string, recursive = true) {
    return this.items.filter((item) => item.isInFolder(folder, recursive));
  }

  /** Find all resources of a given type within a folder */
  filterByClassAndFolder<subclass extends Gms2ResourceSubclassType>(
    resourceClass: subclass,
    folder: string,
    recursive = true,
  ) {
    return this.filterByFolder(folder, recursive).filter(
      (item) => item instanceof resourceClass,
    ) as InstanceType<subclass>[];
  }

  async addSound(source: string, comms: StitchProjectComms) {
    const { name } = paths.parse(source);
    const existingSound = this.findByName(name, Gms2Sound);
    if (existingSound) {
      existingSound.replaceAudioFile(source);
      info(`updated sound ${name}`);
    } else {
      this.push(await Gms2Sound.create(source, comms));
      info(`created sound ${name}`);
    }
    return this;
  }

  async addScript(name: string, code: string, comms: StitchProjectComms) {
    const script = this.findByName(name, Gms2Script);
    if (script) {
      if (script.code !== code) {
        script.code = code;
        info(`script ${name} changed`);
      }
    } else {
      this.push(await Gms2Script.create(name, code, comms));
      info(`created script ${name}`);
    }
    return this;
  }

  async addSprite(
    sourceFolder: string,
    comms: StitchProjectComms,
    nameOverride?: string,
  ) {
    const name = nameOverride || paths.basename(sourceFolder);
    debug(`adding sprite from ${sourceFolder} as name ${name}`);
    const sprite = this.findByName(name, Gms2Sprite);
    if (sprite) {
      await sprite.syncWithSource(sourceFolder);
    } else {
      info(`Adding new sprite '${name}'`);
      this.push(await Gms2Sprite.create(sourceFolder, comms, name));
    }
    return this;
  }

  async addSpineSprite(
    _jsonSourcePath: string,
    comms: StitchProjectComms,
    nameOverride?: string,
  ) {
    const jsonSourcePath = pathy<Spine>(_jsonSourcePath);
    const name = nameOverride || jsonSourcePath.up().basename;
    debug(`adding spine sprite`, { from: jsonSourcePath, name });

    const sprite = this.findByName(name, Gms2Sprite);
    if (sprite) {
      await sprite.syncWithSource(jsonSourcePath.absolute);
    } else {
      info(`Adding new spine sprite ${name}`);
      this.push(await Gms2Sprite.createFromSpine(jsonSourcePath, comms, name));
    }
    return this;
  }

  async addObject(name: string, comms: StitchProjectComms) {
    let object = this.findByName(name, Gms2Object);
    if (!object) {
      object = await Gms2Object.create(name, comms);
      this.push(object);
      info(`created object ${name}`);
    } else {
      info(`object ${name} already exists`);
    }
    return object;
  }

  async addRoom(name: string, comms: StitchProjectComms) {
    let room = this.findByName(name, Gms2Room);
    if (!room) {
      room = await Gms2Room.create(name, comms);
      this.push(room);
      info(`created room ${name}`);
    } else {
      warn(`room ${name} already exists`);
    }
    return room;
  }

  /**
   * Delete a resource, if it exists. **NOTE:** if other
   * resources depend on this one you'll be creating errors
   * by deleting it!
   */
  deleteByName(name: string) {
    const resourceIdx = this.items.findIndex((i) => i.name == name);
    if (resourceIdx < 0) {
      return this;
    }
    const [resource] = this.items.splice(resourceIdx, 1);
    this.project.io.storage.emptyDirSync(resource.yyDirAbsolute);
    return this;
  }

  /**
   * Given Yyp data for a resource that **is not listed in the yyp file**
   * but that **does have .yy and associated files**, add hydrate the object
   * and add it to the Yyp.
   */
  register(data: YypResource, comms: StitchProjectComms) {
    this.items.push(Gms2ResourceArray.hydrateResource(data, comms));
  }

  private push(newResource: Gms2ResourceBase) {
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
      particles: Gms2Particle,
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

  /**
   * Get a new array listing the names of all resource types.
   */
  static get resourceTypeNames() {
    return Object.keys(this.resourceClassMap) as Gms2ResourceType[];
  }

  /**
   * Get all global functions defined across all Scripts
   * (does not include built-ins).
   */
  getGlobalFunctions() {
    return this.scripts.map((script) => script.globalFunctions).flat(2);
  }

  static hydrateResource(data: YypResource, comms: StitchProjectComms) {
    const resourceType = data.id.path.split('/')[0] as Gms2ResourceType;
    // const subclass = Gms2Timeline;
    const subclass = Gms2ResourceArray.resourceClassMap[resourceType];
    if (!subclass) {
      throw new StitchError(
        `No constructor for resource ${resourceType} exists.`,
      );
    }
    const resource = new subclass(data, comms) as Gms2ResourceSubclass;
    return resource;
  }
}

export type Gms2ResourceSubclassType =
  | (typeof Gms2ResourceArray.resourceClassMap)[keyof typeof Gms2ResourceArray.resourceClassMap]
  | typeof Gms2ResourceBase;
export type Gms2ResourceSubclass = InstanceType<Gms2ResourceSubclassType>;
export type Gms2ResourceType = keyof typeof Gms2ResourceArray.resourceClassMap;
