/**
 * @file Typings for components of a freshly-parsed YYP file,
 * when it is stored as a collection of plain objects.
 * See {@link ./Gms2ProjectComponents.ts} for typings related
 * to when the vanilla content has been replaced with class
 * instances.
 */

export interface YypResourceId {
  name: string,
  path: string
}

/** A 'Resource' is a an asset like a sprite, object, script, and so on. */
export interface YypResource {
  id: YypResourceId,
  order: number
}

export interface YypOption {
  ConfigValues?:{[configName:string]:{[field:string]:string}},
  name: string,
  path: string
}

export interface YypConfig {
  name: string,
  children: YypConfig[]
}

export interface YypRoomOrder {
  name: string,
  path: string
}

export interface YypRoomOrderNode {
  roomId:{
    name:string,
    /** rooms/{name}/{name}.yy */
    path:string
  }
}

export interface YypFolder {
  name: string,
  tags: string[],
  folderPath: string,
  order: number,
  resourceType: "GMFolder"
  resourceVersion: "1.0",
}

type StringifiedValues<AnObject> = { [key in keyof AnObject]: string }

/**
 * Can be used in:
 *  1. GMSound for audioGroupId
 *  2. GMExtension for copyToTargets
 *  3. GMExtension for copyToTargets for "files"
 *  4. TextureGroups for all keys
 *  4. AudioGroups
 *  5. GMSprite for textureGroupId
 *  6. GMAndroidOptions(and alike) for everything
 *  TODO: GMSprite and GMSound has more limited keys. Should we create a separate interface?
 */
export interface ConfigValue<Component> {
  [configName: string]: Partial<StringifiedValues<Component>>
}

export interface YypAudioGroup {
  ConfigValues?:{[configName:string]:{[field:string]:string}},
  name: string,
  targets: BigInt,
  resourceType: "GMAudioGroup",
  resourceVersion: "1.0",
}


export interface YypTextureGroup {
  ConfigValues?:{[configName:string]:{[field:string]:string}},
  name: string,
  groupParent?: {
    name: string,
    path: string
  },
  isScaled: boolean,
  autocrop: boolean,
  border: number,
  mipsToGenerate: number,
  targets: BigInt,
  resourceType: "GMTextureGroup",
  resourceVersion: "1.0",
}

enum IncludedFileMask {
  All = -1,
  None = 0,
}

export interface YypIncludedFile {
  ConfigValues?:{[configName:string]:{CopyToMask:string}},
  /** The name of the file, including extension, without the path */
  name: string,
  CopyToMask: IncludedFileMask | number,
  /** `datafiles/${subdir}` */
  filePath: string,
  resourceType: "GMIncludedFile",
  resourceVersion: "1.0",
}

/** The YYP content that has not changed across GMS2.3 subversions */
interface YypComponentsStable{
  name: string,
  resourceType: "GMProject",
  resources: YypResource[],
  Options: YypOption[],
  isDnDProject: boolean,
  isEcma: boolean,
  tutorialPath: string,
  configs: {
    name: 'Default',
    children: YypConfig[]
  },
  Folders: YypFolder[],
  AudioGroups: YypAudioGroup[],
  TextureGroups: YypTextureGroup[],
  IncludedFiles: YypIncludedFile[],
  MetaData: {
    IDEVersion: string
  }
  resourceVersion: string,
  tags: string[],
}

export interface YypComponentsLegacy extends YypComponentsStable{
  RoomOrder: YypRoomOrder[]
}

/** Raw YYP Content from most recent supported IDE */
export interface YypComponents extends YypComponentsStable{
  RoomOrderNodes: YypRoomOrderNode[]
}