import { YypFolder } from "../../types/YypComponents";
import paths from "../paths";

export class Gms2Folder {

  #data:YypFolder;

  constructor(folder:YypFolder){
    this.#data = {...folder};
  }

  /** The path as seen by a user in the IDE. */
  get path(){
    // e.g. folders/sample_resources/group with spaces and !$@#%()*&.yy
    return this.#data.folderPath
      .replace(/^folders\//,'')
      .replace(/.yy$/,'');
  }

  get name(){
    return this.#data.name;
  }

  get dehydrated(): YypFolder{
    return {...this.#data};
  }

  /**
   * Given a path as seen in the IDE,
   * get the 'folderPath' field value used in the .yyp and .yy files
   */
  static folderPathFromPath(path:string){
    return `folders/${path}.yy`;
  }

  /**
   * Given a path as seen in the IDE,
   * get the 'name' field value used in the .yyp and .yy files
   */
  static nameFromPath(path:string){
    return paths.parse(path).name;
  }
}
