import { YypIncludedFile } from "../../types/YypComponents";
import { Gms2Storage } from "../Gms2Storage";
import paths from "../paths";

export class Gms2IncludedFile {

  #data: YypIncludedFile;

  constructor(option:YypIncludedFile,private storage:Gms2Storage){
    this.#data = {...option};
  }

  get name(){ return this.#data.name; }
  /** The directory containing this file, relative to project root  */
  get directoryRelative(){ return this.#data.filePath; }
  get directoryAbsolute(){ return paths.join(this.storage.yypDirAbsolute,this.directoryRelative);}
  get filePathRelative(){
    return paths.join(this.directoryRelative,this.name);
  }
  get filePathAbsolute(){
    return paths.join(this.directoryAbsolute,this.name);
  }

  get dehydrated(): YypIncludedFile{
    return {...this.#data};
  }

  get fileContent(){
    return this.storage.readBlob(this.filePathAbsolute);
  }

  static get defaultDataValues(): Omit<YypIncludedFile,'name'|'filePath'>{
    return {
      CopyToMask: -1,
      resourceType: "GMIncludedFile",
      resourceVersion: "1.0"
    };
  }
}
