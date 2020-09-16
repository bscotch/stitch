import { Gms2Storage } from "./Gms2Storage";
import paths from "./paths";

interface Gms2ProjectConfigFile {
  textureGroupAssignments:{
    [folder:string]:string
  },
  audioGroupAssignments:{
    [folder:string]:string
  }
}

type Gms2ProjectConfigAssignmentField = 'textureGroupAssignments'|'audioGroupAssignments';

/** The Project Config lives alongside the .yyp file */
export class Gms2ProjectConfig {

  private data!: Gms2ProjectConfigFile;

  constructor (readonly storage: Gms2Storage){
    if(!storage.exists(this.filePathAbsolute)){
      this.data = Gms2ProjectConfig.defaultContent;
      this.save();
    }
    this.load();
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
    return Object.values(this.textureGroupAssignments);
  }

  /**
   * The folders that have an assigned texture group,
   * sorted from *least* to *most* specific (allowing
   * texture groups of contained sprites to be assigned
   * in order).
   */
  get foldersWithAssignedTextureGroups(){
    return Gms2ProjectConfig.sortedKeys(this.textureGroupAssignments);
  }

  get audioGroupAssignments(){
    return {...this.data.audioGroupAssignments};
  }

  get audioGroupsWithAssignedFolders(){
    return Object.values(this.audioGroupAssignments);
  }

  /**
   * The folders that have an assigned texture group,
   * sorted from *least* to *most* specific (allowing
   * texture groups of contained sprites to be assigned
   * in order).
   */
  get foldersWithAssignedAudioGroups(){
    return Gms2ProjectConfig.sortedKeys(this.audioGroupAssignments);
  }

  private addGroupAssignement(type:Gms2ProjectConfigAssignmentField,folder:string,group:string){
    this.data[type][folder] = group;
    return this.save();
  }

  private deleteGroupAssignment(type:Gms2ProjectConfigAssignmentField,folder:string){
    Reflect.deleteProperty(this.data[type],folder);
    return this.save();
  }

  addTextureGroupAssignment(folder:string,textureGroup:string){
    return this.addGroupAssignement('textureGroupAssignments',folder,textureGroup);
  }

  deleteTextureGroupAssignment(folder:string){
    return this.deleteGroupAssignment('textureGroupAssignments',folder);
  }

  addAudioGroupAssignment(folder:string,textureGroup:string){
    return this.addGroupAssignement('audioGroupAssignments',folder,textureGroup);
  }

  deleteAudioGroupAssignment(folder:string){
    return this.deleteGroupAssignment('audioGroupAssignments',folder);
  }

  private load(){
    this.data = Gms2ProjectConfig.defaultContent;
    try{
      Object.assign(this.data,this.storage.readJson(this.filePathAbsolute));
    }
    catch(err){
      if( ! this.storage.isReadOnly){ throw err; }
    }
    return this;
  }

  private save(){
    this.storage.saveJson(this.filePathAbsolute,this.data);
    return this;
  }

  static sortedKeys(object:{[key:string]:any}){
    const keys = Object.keys(object);
    keys.sort(paths.pathSpecificitySort);
    return keys;
  }

  static get defaultContent(){
    return {
      textureGroupAssignments:{},
      audioGroupAssignments:{}
    };
  }
}