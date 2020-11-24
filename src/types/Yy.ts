
export interface YyBase {
  ConfigValues?:{[configName:string]:{[field:string]:string}}
  name: string,
  resourceType: string,
  tags: string[],
  /** Parent folder */
  parent: {
    /** Folder's 'name' field */
    name: string,
    /** Folder's 'folderPath' field */
    path: string,
  },
  resourceVersion: "1.0" // constant
}

export interface YyScript extends YyBase {
  isDnD: false,
  isCompatibility: false,
  resourceType: "GMScript"
}