import { NumberFixed } from "../lib/NumberFixed";
import { EmptyArray } from "./Utility";
import { YyBase } from "./Yy";

interface YyRoomView {
  /** Defaults to false */
  inherit: boolean,
  /** Defaults to false */
  visible: boolean,
  /** Defaults to 0 */
  xview: number,
  /** Defaults to 0 */
  yview: number,
  /** Defaults to 1366 */
  wview: number,
  /** Defaults to 768 */
  hview: number,
  /** Defaults to 0 */
  xport: number,
  /** Defaults to 0 */
  yport: number,
  /** Defaults to 1366 */
  wport: number,
  /** Defaults to 768 */
  hport: number,
  /** Defaults to 32 */
  hborder: number,
  /** Defaults to 32 */
  vborder: number,
  /** Defaults to -1 */
  hspeed: number,
  /** Defaults to -1 */
  vspeed: number,
  /** The object being followed */
  objectId: null
}

export interface YyRoomInstance {
  /**
   * *Unique* instance name. Can be any string. Needed to allow multiple
   * instances of the same object to be added to a room via the editor.
   */
  name: string,
  /** (Uknown data structure, starts empty) */
  properties: EmptyArray,
  /** Defaults to false */
  isDnd: boolean,
  /** The type of the object being instanced */
  objectId: {
    /** Object name */
    name: string,
    /** Object resource path, e.g. "objects/{name}/{name}.yy" */
    path: `objects/${string}/${string}.yy`
  },
  /** Defaults to false */
  inheritCode: boolean,
  /** Defaults to false */
  hasCreationCode: false,
  /** Defaults to 4294967295 */
  colour: BigInt,
  /** Defaults to 0.0 */
  rotation: NumberFixed,
  /** Defaults to 1.0 */
  scaleX: NumberFixed,
  /** Defaults to 1.0 */
  scaleY: NumberFixed,
  /** Defaults to 0 */
  imageIndex: number,
  /** Defaults to 1.0 */
  imageSpeed: NumberFixed,
  /** Defaults to null */
  inheritedItemId: null,
  /** Defaults to false */
  frozen: boolean,
  /** Defaults to false */
  ignore: boolean,
  /** Defaults to false */
  inheritItemSettings: boolean,
  /** Initial x-coords of the instance */
  x: NumberFixed,
  /** Initial y-coords of the instance */
  y: NumberFixed,
  resourceVersion:"1.0",
  tags: EmptyArray,
  resourceType:"GMRInstance"
}

export interface YyRoomInstanceLayer {
  instances: YyRoomInstance[],
  visible:true,
  depth:0,
  userdefinedDepth:false,
  inheritLayerDepth:false,
  inheritLayerSettings:false,
  gridX:32,
  gridY:32,
  layers:[],
  hierarchyFrozen:false,
  resourceVersion:"1.0",
  name:"Instances",
  tags:EmptyArray,
  resourceType:"GMRInstanceLayer"
}

interface YyRoomBackgroundLayer {
  spriteId:null,
  colour:4278190080,
  x:0,
  y:0,
  htiled:false,
  vtiled:false,
  hspeed:0.0,
  vspeed:0.0,
  stretch:false,
  animationFPS:15.0,
  animationSpeedType:0,
  userdefinedAnimFPS:false,
  visible:true,
  depth:100,
  userdefinedDepth:false,
  inheritLayerDepth:false,
  inheritLayerSettings:false,
  gridX:32,
  gridY:32,
  layers:[],
  hierarchyFrozen:false,
  resourceVersion:"1.0",
  name:"Background",
  tags:EmptyArray,
  resourceType:"GMRBackgroundLayer"
}

interface YyRoomInstanceCreationOrderEntry {
  /**
   * The *instance name*, which can be custom.
   * Must match one of the YyRoomInstance names.
   */
  name: string,
  /** The room's path */
  path: `rooms/${string}/${string}.yy`
}

/**
 * The data structure of a room's YyFile.
 * **NOTE:** Type genericization is incomplete!
 */
export interface YyRoom extends YyBase{
  layers: (YyRoomInstanceLayer|YyRoomBackgroundLayer)[],
  instanceCreationOrder: YyRoomInstanceCreationOrderEntry[],
  roomSettings: {
    inheritRoomSettings: false,
    Width: 1366,
    Height: 768,
    persistent: false,
  },
  viewSettings: {
    inheritViewSettings: false,
    enableViews: false,
    clearViewBackground: false,
    clearDisplayBuffer: true,
  },
  physicsSettings: {
    inheritPhysicsSettings: false,
    PhysicsWorld: false,
    PhysicsWorldGravityX: 0.0,
    PhysicsWorldGravityY: 10.0,
    PhysicsWorldPixToMetres: 0.1,
  },
  isDnd: boolean,
  /** 0-1 */
  volume: number,
  /** Incomplete -- having parent likely changes value */
  parentRoom: null,
  /** 8 identical 'views' are created by default. */
  views: YyRoomView[],
  inheritLayers: false,
  creationCodeFile: "",
  inheritCode: false,
  inheritCreationOrder: false,
  sequenceId: null,
  resourceType: "GMRoom"
}

export const yyRoomInstanceDefaults = {
  properties: [] as EmptyArray,
  isDnd: false,
  inheritCode: false,
  hasCreationCode: false,
  colour: BigInt(4294967295),
  /** Defaults to 0.0 */
  rotation: new NumberFixed(0.0),
  /** Defaults to 1.0 */
  scaleX: new NumberFixed(1.0),
  /** Defaults to 1.0 */
  scaleY: new NumberFixed(1.0),
  /** Defaults to 0 */
  imageIndex: 0,
  /** Defaults to 1.0 */
  imageSpeed: new NumberFixed(1.0),
  /** Defaults to null */
  inheritedItemId: null,
  /** Defaults to false */
  frozen: false,
  /** Defaults to false */
  ignore: false,
  /** Defaults to false */
  inheritItemSettings: false,
  resourceVersion:"1.0",
  tags: [] as EmptyArray,
  resourceType:"GMRInstance"
} as const;
