import { Gms2Storage } from "./Gms2Storage";

interface Gms2ProjectConfigFile {
  texturePageAssignments:{
    [folder:string]:string
  },
  audioGroupAssignments:{
    [folder:string]:string
  }
}

export class Gms2ProjectConfig {
  constructor (private storage: Gms2Storage){

  }

  // get filePathAbsolute(){

  // }
}