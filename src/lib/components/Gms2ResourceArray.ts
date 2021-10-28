import { dehydrateArray } from '../hydrate';
import { Gms2ResourceBase } from './resources/Gms2ResourceBase';
import { Gms2Sound } from '../components/resources/Gms2Sound';
import { YypResource } from '../../types/Yyp';
import { assert, StitchError } from '../errors';
import { Gms2Storage } from '../Gms2Storage';
import paths from '../paths';
import { Gms2Sprite } from './resources/Gms2Sprite';
import { difference, uniqBy } from 'lodash';
import { info, debug } from '../log';
import { Gms2Script } from './resources/Gms2Script';
import { Gms2Animation } from './resources/Gms2Animation';
import { Gms2Extension } from './resources/Gms2Extension';
import { Gms2Font } from './resources/Gms2Font';
import { Gms2Note } from './resources/Gms2Note';
import { Gms2Object } from './resources/Gms2Object';
import { Gms2Path } from './resources/Gms2Path';
import { Gms2Room } from './resources/Gms2Room';
import { Gms2Sequence } from './resources/Gms2Sequence';
import { Gms2Shader } from './resources/Gms2Shader';
import { Gms2Tileset } from './resources/Gms2Tileset';
import { Gms2Timeline } from './resources/Gms2Timeline';
import { Spine } from '../../types/Spine';
import { uuidV4 } from '../uuid';
import { SpriteType } from '../../types/YySprite';

export class Gms2ResourceArray {
  private items: Gms2ResourceSubclass[];

  constructor(data: YypResource[], private storage: Gms2Storage) {
    const uniqueData = uniqBy(data, 'id.name');
    const removedItems = difference(data, uniqueData);
    if (removedItems.length) {
      info(
        `Duplicate resources found: ${removedItems.length} duplicates removed`,
      );
    }
    this.items = data.map((item) =>
      Gms2ResourceArray.hydrateResource(item, storage),
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

  addSound(source: string, storage: Gms2Storage) {
    const { name } = paths.parse(source);
    const existingSound = this.findByName(name, Gms2Sound);
    if (existingSound) {
      existingSound.replaceAudioFile(source);
      info(`updated sound ${name}`);
    } else {
      this.push(Gms2Sound.create(source, storage));
      info(`created sound ${name}`);
    }
    return this;
  }

  addScript(name: string, code: string, storage: Gms2Storage) {
    const script = this.findByName(name, Gms2Script);
    if (script) {
      script.code = code;
      info(`updated script ${name}`);
    } else {
      this.push(Gms2Script.create(name, code, storage));
      info(`created script ${name}`);
    }
    return this;
  }

  addSprite(sourceFolder: string, storage: Gms2Storage, nameOverride?: string) {
    const name = nameOverride || paths.basename(sourceFolder);
    debug(`adding sprite from ${sourceFolder} as name ${name}`);
    const sprite = this.findByName(name, Gms2Sprite);
    if (sprite) {
      sprite.replaceFrames(sourceFolder);
      info(`updated sprite ${name}`);
    } else {
      this.push(Gms2Sprite.create(sourceFolder, storage, name));
      info(`created sprite ${name}`);
    }
    return this;
  }

  addSpineSprite(
    jsonSourcePath: string,
    storage: Gms2Storage,
    nameOverride?: string,
  ) {
    const sourceSpineName = paths.parse(jsonSourcePath).name;
    const sourcePathWithoutExt = paths.join(
      paths.dirname(jsonSourcePath),
      sourceSpineName,
    );
    const name = nameOverride || sourceSpineName;

    debug(`adding spine sprite from ${jsonSourcePath} as name ${name}`);

    const createDestPath = (sprite: Gms2Sprite, name: string, ext: string) => {
      return paths.join(sprite.yyDirAbsolute, `${name}.${ext}`);
    };
    const createSourcePath = (ext: string) => {
      return `${sourcePathWithoutExt}.${ext}`;
    };
    const copySpriteSheet = (sprite: Gms2Sprite) => {
      storage.copyFile(
        createSourcePath('png'),
        createDestPath(sprite, sourceSpineName, 'png'),
      );
    };

    const defaultSpriteImagePath = paths.join(
      __dirname,
      '..',
      '..',
      '..',
      'assets',
      'sprite-default',
      'subimage.png',
    );

    // Make sure the JSON file is a valid export.
    try {
      const jsonContent: Spine = storage.readJson(jsonSourcePath);
      assert(
        jsonContent.skeleton.spine,
        'The target JSON file is not from Spine.',
      );
      assert(
        jsonContent.skeleton.spine.startsWith('3.7.'),
        'GameMaker Studio 2.3 is only compatible with Spine 3.7.X',
      );
    } catch (err) {
      throw err instanceof StitchError
        ? err
        : new StitchError(
            `There is no valid Spine JSON file at ${jsonSourcePath}.`,
          );
    }

    // Make sure we have image and atlas files
    for (const ext of ['png', 'atlas']) {
      assert(
        storage.exists(createSourcePath(ext)),
        `Expected Spine file ${createSourcePath(ext)} does not exist.`,
      );
    }

    let sprite = this.findByName(name, Gms2Sprite);

    // If the sprite already exists, and is a Spine sprite,
    // just replace the existing Spine files and keep the
    // name as the existing frameId
    const existingSpineFrameId = paths.parse(
      sprite?.filePathsRelative.find((x) => x.endsWith('.atlas')) || '',
    ).name;
    if (sprite && existingSpineFrameId) {
      // Copy the atlas and JSON files, renaming in the process
      for (const ext of ['atlas', 'json']) {
        storage.copyFile(
          createSourcePath(ext),
          createDestPath(sprite, existingSpineFrameId, ext),
        );
      }
      // Directly copy over the spritesheet
      // (must keep its name, which is sourceSpineName, since the atlas file references it)
      copySpriteSheet(sprite);
      // Attempt to trigger a GameMaker cache reset by rewriting the thumbnail
      const thumbnailPath = createDestPath(sprite, existingSpineFrameId, 'png');
      this.storage.deleteFile(thumbnailPath);
      this.storage.copyFile(defaultSpriteImagePath, thumbnailPath);
      info(`updated spine sprite ${name}`);
      return this;
    }

    // Otherwise either the sprite doesn't exist or it's not already a Spine sprite.
    // In either case, the easiest move is to replace the existing sprite with a new
    // one that has

    const spriteAlreadyExists = Boolean(sprite);
    const frameId = uuidV4();
    sprite =
      sprite ||
      Gms2Sprite.create(paths.dirname(defaultSpriteImagePath), storage, name);
    if (!spriteAlreadyExists) {
      this.push(sprite);
    }
    const oldFrameIds = sprite.frameIds;
    for (const fid of oldFrameIds) {
      // Purge the old crap
      const layerFolderPath = paths.join(sprite.yyDirAbsolute, 'layers', fid);
      const compositeImagePath = paths.join(sprite.yyDirAbsolute, `${fid}.png`);
      storage.emptyDir(layerFolderPath, true);
      storage.deleteFile(compositeImagePath);
    }
    sprite.clearFrames();
    // Create a new layerId that doesn't point to anything
    sprite.setLayerId(uuidV4());
    sprite.addFrame(defaultSpriteImagePath, frameId); // Adds the thumbnail PNG
    sprite.spriteType = SpriteType.Spine;
    sprite.save();

    for (const ext of ['atlas', 'json']) {
      storage.copyFile(
        createSourcePath(ext),
        createDestPath(sprite, frameId, ext),
      );
    }
    // Copy over the spritesheet.
    copySpriteSheet(sprite);
    info(`created spine sprite ${name}`);
    return this;
  }

  addObject(name: string, storage: Gms2Storage) {
    let object = this.findByName(name, Gms2Object);
    if (!object) {
      object = Gms2Object.create(name, storage);
      this.push(object);
      info(`created object ${name}`);
    } else {
      info(`object ${name} already exists`);
    }
    return object;
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
    this.storage.emptyDir(resource.yyDirAbsolute);
    return this;
  }

  /**
   * Given Yyp data for a resource that **is not listed in the yyp file**
   * but that **does have .yy and associated files**, add hydrate the object
   * and add it to the Yyp.
   */
  register(data: YypResource, storage: Gms2Storage) {
    this.items.push(Gms2ResourceArray.hydrateResource(data, storage));
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
   * Get all global functions defined across all Scripts
   * (does not include built-ins).
   */
  getGlobalFunctions() {
    return this.scripts.map((script) => script.globalFunctions).flat(2);
  }

  static hydrateResource(data: YypResource, storage: Gms2Storage) {
    const resourceType = data.id.path.split('/')[0] as Gms2ResourceType;
    // const subclass = Gms2Timeline;
    const subclass = Gms2ResourceArray.resourceClassMap[resourceType];
    if (!subclass) {
      throw new StitchError(
        `No constructor for resource ${resourceType} exists.`,
      );
    }
    const resource = new subclass(data, storage) as Gms2ResourceSubclass;
    return resource;
  }
}

export type Gms2ResourceSubclassType =
  | typeof Gms2ResourceArray.resourceClassMap[keyof typeof Gms2ResourceArray.resourceClassMap]
  | typeof Gms2ResourceBase;
export type Gms2ResourceSubclass = InstanceType<Gms2ResourceSubclassType>;
export type Gms2ResourceType = keyof typeof Gms2ResourceArray.resourceClassMap;
