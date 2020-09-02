import {Resource} from './Resource';
import type {RawResource} from "../types/project";
import type {Project} from "../Project";

export class Note extends Resource{

  constructor(project:Project,resource:RawResource){
    super(project,resource,"GMNotes");
  }

  get associatedFiles(){
    // The actual data file is stored in "datafiles" (instead of "datafiles_yy")
    // but otherwise with the same directory structure.
    const dataFilePath = this.absoluteYyPath.replace(".yy",".txt");
    return [dataFilePath];
  }
}