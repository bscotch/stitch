import { YySound } from "../../../types/Yy";
import { Gms2ResourceBase, Gms2ResourceBaseParameters} from "./Gms2ResourceBase";
import paths from "../../paths";
import { Gms2Storage } from "../../Gms2Storage";
import type { ResourceType } from "../Gms2ResourceArray";

export class Gms2Sound extends Gms2ResourceBase {
  static myResourceType: ResourceType = "sounds";
  protected yyData!: YySound; // Happens in the super() constructor

  constructor(...setup: Gms2ResourceBaseParameters) {
    super(Gms2Sound.myResourceType, ...setup);
  }

  protected createYyFile(){
    const yyData: YySound = {
      name: this.name,
      soundFile: this.name,
      tags: [],
      parent: Gms2Sound.parentDefault,
      compression: 0,
      volume: 1,
      preload: false,
      bitRate: 128,
      sampleRate: 44100,
      type: 1,
      bitDepth: 1,
      audioGroupId: Gms2Sound.audioGroupIdDefault,
      resourceType: "GMSound",
      resourceVersion: "1.0",
    };
    this.storage.saveJson(this.yyPathAbsolute,yyData);
  }

  get audioFilePathAbsolute(){
    return paths.join(this.yyDirAbsolute,this.yyData.soundFile);
  }

  /** Overwrite this Sound's audio file with an external file. */
  replaceAudioFile(externalAudioFilePath:string){
    const extension = paths.extname(externalAudioFilePath);
    const oldFileName = this.yyData.soundFile;
    const newFileName = `${this.name}${extension}`;
    if(oldFileName != newFileName){
      this.storage.deleteFile(this.audioFilePathAbsolute);
    }
    this.yyData.soundFile = newFileName;
    this.storage.copyFile(externalAudioFilePath,this.audioFilePathAbsolute);
    return this;
  }

  get audioGroup(){
    return this.yyData.audioGroupId.name;
  }

  set audioGroup(name:string){
    this.yyData.audioGroupId.name = name;
    this.yyData.audioGroupId.path = `audiogroups/${name}`;
    this.save();
  }

  static get audioGroupIdDefault(){
    return {
      name: 'audiogroup_default',
      path: "audiogroups/audiogroup_default",
    };
  }

  /**
   * Given a sound file, create a Gamemaker Sound asset with default parameter values.
   * The resource will be named after the source file.
  */
  static create(externalAudioFilePath:string,storage:Gms2Storage): Gms2Sound {
    const {name} = paths.parse(externalAudioFilePath);
    return new Gms2Sound(name,storage,true)
      .replaceAudioFile(externalAudioFilePath);
  }
}
