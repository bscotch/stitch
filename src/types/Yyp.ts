export interface YypResource {
  id: {
    name: string,
    path: string
  },
  order: number
}

export interface YypOption {
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

export interface YypFolder {
  name:string,
  tags:string,
  folderPath:string,
  order:number,
  resourceType:"GMFolder"
  resourceVersion:"1.0",
}

export interface YypAudioGroup {
  name:string,
  targets: BigInt,
  resourceType:"GMAudioGroup",
  resourceVersion:"1.0",
}

export interface YypTextureGroup {
  name:string,
  isScaled: boolean,
  autocrop: boolean,
  border: number,
  mipsToGenerate: number,
  targets: BigInt,
  resourceType:"GMTextureGroup",
  resourceVersion:"1.0",
}

export interface YypInludedFiles {
  name:string,
  CopyToMask:number,
  filePath:string,
  resourceType:"GMIncludedFile",
  resourceVersion:"1.0",
}

/** Raw YYP Content as plain objects (read directly from file and JSON parsed) */
export interface YypContent {
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
  RoomOrder: YypRoomOrder[],
  Folders: YypFolder[],
  AudioGroups: YypAudioGroup[],
  TextureGroups: YypTextureGroup[],
  IncludedFiles: YypInludedFiles[],
  MetaData: {
    IDEVersion: string
  }
  resourceVersion: string,
  tags: string[],
}