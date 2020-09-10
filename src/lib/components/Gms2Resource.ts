import { YypResource } from "../../types/YypComponents";
import {Inverted} from "../../types/Utility";
import {invert} from "lodash";
import {Gms2PipelineError} from "../errors";
import {Gms2Sound} from "./resources/Gms2Sound";

export class Gms2Resource {

  #data: YypResource;

  constructor(data:YypResource){
    this.#data = {...data};
  }

  /**
   * Name of the parent directory for this resource type,
   * which is also the first part of its "path" field value.
   * E.g. {path:"sprites/mySprite/mySprite.yy"} yields "sprites"
   */
  get pathType(){
    return Gms2Resource.pathTypeFromPath(this.#data);
  }

  /**
   * Gamemaker's internal naming for this resource type,
   * used in the "resourceType" fields of the .yy files.
   */
  get internalType(){
    return Gms2Resource.pathTypeToInternalType[this.pathType];
  }

  get dehydrated(): YypResource{
    return {...this.#data};
  }

  static get pathTypeToInternalType(){
    return {
      animcurves: 'GMAnimCurve',
      configs: 'GMConfig',
      datafiles: 'GMIncludedFile',
      extensions: 'GMExtension',
      fonts: 'GMFont',
      notes: 'GMNotes',
      objects: 'GMObject',
      options: 'GMOptions',
      paths: 'GMPath',
      rooms: 'GMRoom',
      scripts: 'GMScript',
      sequences: 'GMSequence',
      shaders: 'GMShader',
      sounds: 'GMSound',
      sprites: 'GMSprite',
      tilesets: 'GMTileSet',
      timelines: 'GMTimeline',
      views: 'GMFolder',
    } as const;
  }

  static get internalTypeToClasses(){
    const classMap = {
      GMAnimCurve: Gms2Resource,    // ❌
      GMConfig: Gms2Resource,       // ❌
      GMIncludedFile: Gms2Resource, // ❌
      GMExtension: Gms2Resource,    // ❌
      GMFont: Gms2Resource,         // ❌
      GMNotes: Gms2Resource,        // ❌
      GMObject: Gms2Resource,       // ❌
      GMOptions: Gms2Resource,      // ❌
      GMPath: Gms2Resource,         // ❌
      GMRoom: Gms2Resource,         // ❌
      GMScript: Gms2Resource,       // ❌
      GMSequence: Gms2Resource,     // ❌
      GMShader: Gms2Resource,       // ❌
      GMSound: Gms2Sound,           // ✅
      GMSprite: Gms2Resource,       // ❌
      GMTileSet: Gms2Resource,      // ❌
      GMTimeline: Gms2Resource,     // ❌
      GMFolder: Gms2Resource,       // ❌
    } as const;
    return classMap;
  }

  static get internalTypeToPathType(){
    return invert(Gms2Resource.pathTypeToInternalType) as Inverted<typeof Gms2Resource.pathTypeToInternalType>;
  }

  /**
   * Given the {id:{path:'pathType/...'}} data structure from the YYP
   * file, get the path type.
   */
  static pathTypeFromPath(data:YypResource){
    return data.id.path.split('/')[0] as keyof Gms2ResourcePathTypeToInternalType;
  }

  static create(data:YypResource){
    // TODO: Determine type and crate appropriate instance.
    const pathType = Gms2Resource.pathTypeFromPath(data);
    const internalType = Gms2Resource.pathTypeToInternalType[pathType];
    const subclass = this.internalTypeToClasses[internalType];
    if(!subclass){
      throw new Gms2PipelineError(
        `No constructor for resource ${internalType} (${pathType}) exists.`
      );
    }
    const resource = new subclass(data) as InstanceType<Gms2ResourceSubclass>;
    return resource;
  }
}


export type Gms2ResourcePathTypeToInternalType = typeof Gms2Resource.pathTypeToInternalType;
export type Gms2ResourceInternalTypeToPathType = Inverted<Gms2ResourcePathTypeToInternalType>;
export type Gms2ResourceSubclass = InstanceType<typeof Gms2Resource.internalTypeToClasses[keyof typeof Gms2Resource.internalTypeToClasses]>