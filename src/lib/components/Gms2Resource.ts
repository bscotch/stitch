//❌✅⌛❓

import { YypResource } from "../../types/YypComponents";
import { Gms2PipelineError } from "../errors";
import { Gms2Sound } from "./resources/Gms2Sound";

export class Gms2Resource {

  #data: YypResource;

  constructor(data: YypResource) {
    this.#data = { ...data };
  }

  /**
   * Name of the parent directory for this resource type,
   * which is also the first part of its "path" field value.
   * E.g. {path:"sprites/mySprite/mySprite.yy"} yields "sprites"
   */
  get type() {
    return Gms2Resource.typeFromPath(this.#data);
  }


  get dehydrated(): YypResource {
    return { ...this.#data };
  }

  static get typeToClassMap() {
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

  /**
   * Given the {id:{path:'pathType/...'}} data structure from the YYP
   * file, get the path type.
   */
  static typeFromPath(data: YypResource) {
    return data.id.path.split('/')[0] as (keyof typeof Gms2Resource.typeToClassMap);
  }

  static create(data: YypResource) {
    const pathType = Gms2Resource.typeFromPath(data);
    const subclass = this.typeToClassMap[pathType];
    if (!subclass) {
      throw new Gms2PipelineError(
        `No constructor for resource ${pathType} exists.`
      );
    }
    const resource = new subclass(data) as Gms2ResourceSubclass;
    return resource;

  }
}

export type Gms2ResourceSubclass = InstanceType<typeof Gms2Resource.typeToClassMap[keyof typeof Gms2Resource.typeToClassMap]>