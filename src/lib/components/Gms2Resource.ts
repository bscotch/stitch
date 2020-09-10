import { YypResource } from "../../types/YypComponents";
import {Inverted} from "../../types/Utility";
import {invert} from "lodash";

export class Gms2Resource {

  #data: YypResource;

  constructor(option:YypResource){
    this.#data = {...option};
  }

  /**
   * Name of the parent directory for this resource type,
   * which is also the first part of its "path" field value.
   * E.g. {path:"sprites/mySprite/mySprite.yy"} yields "sprites"
   */
  get pathType(){
    return this.#data.id.path.split('/')[0] as keyof Gms2ResourcePathTypeToInternalType;
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

  static get internalTypeToPathType(){
    return invert(Gms2Resource.pathTypeToInternalType) as Inverted<typeof Gms2Resource.pathTypeToInternalType>;
  }
}


export type Gms2ResourcePathTypeToInternalType = typeof Gms2Resource.pathTypeToInternalType;
export type Gms2ResourceInternalTypeToPathType = Inverted<Gms2ResourcePathTypeToInternalType>;
