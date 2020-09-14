import { YySound } from "../../../types/Yy";
import { Gms2Resource } from "../Gms2Resource";

export class Gms2Sound extends Gms2Resource {

  #yyData!: YySound; // Happens in the super() constructor

  constructor(...setup: ConstructorParameters<typeof Gms2Resource>) {
    super(...setup);
  }

  get audioFilePathAbsolute(){
    return this.dataFilePathAbsolute('.ogg');
  }

  /** Overwrite this Sound's audio file with an external file. */
  replaceAudioFile(externalAudioFilePath:string){
    // Audio file's name is the same as the resource name
    this.storage.copyFile(externalAudioFilePath,this.audioFilePathAbsolute);
  }

  /**
   * Given a sound file, create a Gamemaker Sound asset with default parameter values.
   * The resource will be named after the source file.
  */
  static create(): Gms2Sound {
    
  }
}
