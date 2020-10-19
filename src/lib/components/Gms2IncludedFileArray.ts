import { YypIncludedFile } from "../../types/Yyp";
import { Gms2Storage } from "../Gms2Storage";
import { Gms2ComponentArrayWithStorage } from "./Gms2ComponentArrayWithStorage"
import { Gms2IncludedFile } from "./Gms2IncludedFile";

export class Gms2IncludedFileArray extends Gms2ComponentArrayWithStorage<YypIncludedFile, typeof Gms2IncludedFile>{

  constructor(data:YypIncludedFile[],storage: Gms2Storage){
    super(data,Gms2IncludedFile,storage);
  }

  filterByModule(moduleName:string){
    return this.items.filter(item=>item.isInModule(moduleName));
  }
}
