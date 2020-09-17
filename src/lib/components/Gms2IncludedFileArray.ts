import { difference, uniqBy } from "lodash";
import { YypIncludedFile } from "../../types/YypComponents";
import { Gms2Storage } from "../Gms2Storage";
import { dehydrateArray, hydrateArray } from "../hydrate";
import { logInfo } from "../log";
import { Gms2IncludedFile } from "./Gms2IncludedFile";

export class Gms2IncludedFileArray{

  protected items: Gms2IncludedFile[];

  constructor(data:YypIncludedFile[],private storage:Gms2Storage){
    // Remove duplicates
    const uniqueData = uniqBy(data,'name');
    const removedItems = difference(data,uniqueData);
    if(removedItems.length){
      logInfo(`Duplicate included files found: ${removedItems.length} duplicates removed`);
    }
    this.items = hydrateArray(uniqueData,Gms2IncludedFile);
  }

  get dehydrated(): YypIncludedFile[] {
    return dehydrateArray(this.items);
  }
}
