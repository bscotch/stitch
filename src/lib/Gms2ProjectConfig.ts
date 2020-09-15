import { Gms2Storage } from "./Gms2Storage";

interface Gms2ProjectConfigFile {
  texturePageAssignments:{
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
      texturePageAssignments:{},
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

  get texturePageAssignments(){
    return {...this.data.texturePageAssignments};
  }

  get texturePagesWithAssignedFolders(){
    return Object.keys(this.texturePageAssignments);
  }

  get audioGroupAssignments(){
    return {...this.data.audioGroupAssignments};
  }

  get audioGroupsWithAssignedFolders(){
    return Object.keys(this.audioGroupAssignments);
  }

  upsertTexturePageAssignment(folder:string,texturePage:string){
    this.data.texturePageAssignments[folder] = texturePage;
    this.save();
  }

  deleteTexturePageAssignment(folder:string){
    Reflect.deleteProperty(this.data.texturePageAssignments,folder);
    this.save();
  }

  upsertAudioGroupAssignment(folder:string,texturePage:string){
    this.data.audioGroupAssignments[folder] = texturePage;
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