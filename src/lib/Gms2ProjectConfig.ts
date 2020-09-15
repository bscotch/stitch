import { Gms2Storage } from "./Gms2Storage";

interface Gms2ProjectConfigFile {
  textureGroupAssignments:{
    [folder:string]:string
  },
  audioGroupAssignments:{
    [folder:string]:string
  }
}

/** The Project Config lives alongside the .yyp file */
export class Gms2ProjectConfig {

  private data: Gms2ProjectConfigFile;

  constructor (readonly storage: Gms2Storage){
    const initialContent = {
      textureGroupAssignments:{},
      audioGroupAssignments:{}
    };
    if(!storage.exists(this.filePathAbsolute)){
      this.data = initialContent;
      this.save();
    }
    this.data = {
      ...initialContent,
      ...storage.readJson(this.filePathAbsolute)
    };
  }

  get name(){
    return 'gms2pdk.config.json';
  }

  get filePathAbsolute(){
    return this.storage.toAbsolutePath(this.name);
  }

  get textureGroupAssignments(){
    return {...this.data.textureGroupAssignments};
  }

  get textureGroupsWithAssignedFolders(){
    return Object.keys(this.textureGroupAssignments);
  }

  get audioGroupAssignments(){
    return {...this.data.audioGroupAssignments};
  }

  get audioGroupsWithAssignedFolders(){
    return Object.keys(this.audioGroupAssignments);
  }

  upsertTextureGroupAssignment(folder:string,textureGroup:string){
    this.data.textureGroupAssignments[folder] = textureGroup;
    this.save();
  }

  deleteTextureGroupAssignment(folder:string){
    Reflect.deleteProperty(this.data.textureGroupAssignments,folder);
    this.save();
  }

  upsertAudioGroupAssignment(folder:string,textureGroup:string){
    this.data.audioGroupAssignments[folder] = textureGroup;
    this.save();
  }

  deleteAudioGroupAssignment(folder:string){
    Reflect.deleteProperty(this.data.audioGroupAssignments,folder);
    this.save();
  }

  private save(){
    this.storage.saveJson(this.filePathAbsolute,this.data);
  }
}