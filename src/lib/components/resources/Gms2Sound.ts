import { YySound } from "../../../types/Yy";
import { Gms2Resource } from "../Gms2Resource";
import paths from "../../paths";
import { Gms2Storage } from "../../Gms2Storage";
import { assert } from "../../errors";

export class Gms2Sound extends Gms2Resource {

  protected yyData!: YySound; // Happens in the super() constructor

  constructor(...setup: ConstructorParameters<typeof Gms2Resource>) {
    super(...setup);
  }

  createYyFile(){

  }

  get audioFilePathAbsolute(){
    return paths.join(this.yyDirAbsolute,this.yyData.soundFile);
  }

  /** Overwrite this Sound's audio file with an external file. */
  replaceAudioFile(externalAudioFilePath:string){
    assert(
      paths.extname(this.audioFilePathAbsolute)==paths.extname(externalAudioFilePath),
      'source audio type does not match current type'
    );
    // Audio file's name is the same as the resource name
    this.storage.copyFile(externalAudioFilePath,this.audioFilePathAbsolute);
    return this;
  }

  /**
   * Given a sound file, create a Gamemaker Sound asset with default parameter values.
   * The resource will be named after the source file.
  */
  static create(externalAudioFilePath:string,storage:Gms2Storage): Gms2Sound {
    // TODO: Refactor to make use of createYyFile()

    const {name,base} = paths.parse(externalAudioFilePath);

    const constants = {
      resourceVersion: "1.0",
      resourceType: "GMSound",
    } as const;

    const yyData: YySound = {
      ...constants,
      name,
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
      soundFile: base,
    };

    // Create the .yy file and copy over the audio file
    const localPath = (file:string)=>paths.join('sounds',name,file);
    const localSoundYy   = localPath(`${name}.yy`);
    const localAudioPath = localPath(base);
    const absPath = (local:string)=> paths.join(storage.yypDirAbsolute,local);
    const absSoundDir    = absPath(localPath(''));
    const absSoundYy     = absPath(localSoundYy);
    const absAudioPath   = absPath(localAudioPath);

    storage.ensureDir(absSoundDir);
    storage.saveJson(absSoundYy,yyData);
    storage.copyFile(externalAudioFilePath,absAudioPath);
    return new Gms2Sound(localSoundYy,storage);
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
}
