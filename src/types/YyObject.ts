import { EmptyArray } from "./Utility";
import { YyBase } from "./Yy";
import { YypResourceId } from "./Yyp";

// TODO: Figure out the enum
enum YyObjectEventType {
  Create,
  Destroy,
  Alarm,
  Step,
  Draw=8,
  Cleanup=12,
}

enum YyObjectDrawEventNum {
  Draw,
  DrawGui = 64,
  WindowResize = 65,
  DrawBegin = 72,
  DrawEnd = 73,
  DrawGuiBegin = 74,
  DrawGuiEnd = 75,
  PreDraw = 76,
  PostDraw = 77,
}

enum YyObjectStepEventNum {
  Step,
  BeginStep,
  EndStep
}

type YyObjectAlarmEventNum = 0|1|2|3|4|5|6|7|8|9|10|11;

interface YyObjectEvent {
  isDnD: false,
  eventNum: YyObjectEventType,
  /** 0 for cases where there aren't multiple types */
  eventType: number,
  collisionObjectId: null|YypResourceId,
  /** The object's ID */
  parent: YypResourceId,
  name: "",
  tags: EmptyArray,
  resourceVersion: "1.0",
  resourceType: "GMEvent"
}

interface YyObjectCreateEvent extends YyObjectEvent {
  eventNum: YyObjectEventType.Create
}

interface YyObjectDestroyEvent extends YyObjectEvent {
  eventNum: YyObjectEventType.Destroy
}

interface YyObjectCleanupEvent extends YyObjectEvent {
  eventNum: YyObjectEventType.Cleanup
}

interface YyObjectStepEvent extends YyObjectEvent {
  eventNum: YyObjectEventType.Step,
  eventType: YyObjectStepEventNum
}

interface YyObjectAlarmEvent extends YyObjectEvent {
  eventNum: YyObjectEventType.Alarm,
  eventType: YyObjectAlarmEventNum
}

interface YyObjectDrawEvent extends YyObjectEvent {
  eventNum: YyObjectEventType.Draw,
  eventType: YyObjectDrawEventNum
}

// TODO: ... there are MANY MORE events to plug in here. May want to approach this differently.

enum YyObjectPropertyVarType {
  Real,
  Integer,
  String,
  Boolean,
  Expression,
  Asset,
  List,
  Colour
}

/** From the "Variable Definitions" editor  */
interface YyObjectProperty {
  /** The variable's name */
  name: string,
  varType: YyObjectPropertyVarType,
  /** Stringified starting value. If a color, prefixed with a '$' (unkown format). */
  value: string,
  rangeEnabled:false,
  /** (Unknown parameter) */
  rangeMin: number,
  /** (Unknown parameter) */
  rangeMax: number,
  /** Always exists, but only meaningful for Lists */
  listItems: string[],
  /** Always exists, but only meaningful for Lists */
  multiselect: false,
  /** (Unknown parameter) */
  filters: EmptyArray,
  resourceVersion:"1.0",
  tags: EmptyArray,
  resourceType:"GMObjectProperty"
}

export interface YyObject extends YyBase {
  spriteId: null | YypResourceId,
  solid: boolean,
  visible: boolean,
  /** If self (default) can be set to null */
  spriteMaskId: null | YypResourceId,
  persistent: boolean,
  parentObjectId: null | YypResourceId,
  physicsObject: boolean,
  physicsSensor: boolean,
  /** Default 1 */
  physicsShape: number,
  /** Default 1 */
  physicsGroup: number,
  /** Default 0.5 */
  physicsDensity: number,
  /** Default 0.1 */
  physicsRestitution: number,
  /** Default 0.1 */
  physicsLinearDamping: number,
  /** Default 0.1 */
  physicsAngularDamping: number,
  /** Default 0.2 */
  physicsFriction: number,
  /** Default true */
  physicsStartAwake: boolean,
  /** Default false */
  physicsKinematic: boolean,
  /** Defaults to empty array */
  physicsShapePoints: {x:number,y:number}[],
  eventList: YyObjectEvent[],
  properties: YyObjectProperty[],
  /** (Unknown parameter) */
  overriddenProperties: EmptyArray,
  resourceType: "GMObject",
}

export const yyDataDefaults: Omit<YyObject,'name'|'parent'> = {
  spriteId: null,
  solid: false,
  visible: true,
  spriteMaskId: null,
  persistent: false,
  parentObjectId: null,
  physicsObject: false,
  physicsSensor: false,
  physicsShape: 1,
  physicsGroup: 1,
  physicsDensity: 0.5,
  physicsRestitution: 0.1,
  physicsLinearDamping: 0.1,
  physicsAngularDamping: 0.1,
  physicsFriction: 0.2,
  physicsStartAwake: true,
  physicsKinematic: false,
  physicsShapePoints: [],
  eventList: [],
  properties: [],
  overriddenProperties: [],
  resourceVersion: "1.0",
  tags: [],
  resourceType: "GMObject",
};
