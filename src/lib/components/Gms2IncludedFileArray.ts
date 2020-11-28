import { YypIncludedFile } from "../../types/Yyp";
import { Gms2Storage } from "../Gms2Storage";
import { Gms2ComponentArrayWithStorage } from "./Gms2ComponentArrayWithStorage";
import { Gms2IncludedFile } from "./Gms2IncludedFile";

export class Gms2IncludedFileArray extends Gms2ComponentArrayWithStorage<YypIncludedFile, typeof Gms2IncludedFile>{

  constructor(data:YypIncludedFile[],storage: Gms2Storage){
    super(data,Gms2IncludedFile,storage);
  }

  /**
   * Delete a file, if it exists.
   */
  deleteByName(baseName:string){
    const fileIdx = this.items.findIndex(i=>i.name==baseName);
    if(fileIdx<0){
      return this;
    }
    const [file] = this.items.splice(fileIdx,1);
    this.storage.deleteFile(file.filePathAbsolute);
    return this;
  }
}
