import {Resource} from './Resource';
import {spriteTemplateType} from './templates/sprite';
import {Project} from "../Project";
import {RawResource} from "../types/project";
import json from "../lib/json";

export class Sprite extends Resource{
  rawDataFromYY: spriteTemplateType;

  constructor(project:Project,resource:RawResource){
    super(project,resource,'GMSprite');
    this.rawDataFromYY = json.readFileSync(this.absoluteYyPath);
  }

  set textureGroupID (textureGroupID: string) {
    if (this.rawDataFromYY.textureGroupId != textureGroupID) {
      this.rawDataFromYY.textureGroupId = textureGroupID;
      this.commit();
    }
  }

  commit() {
    this.project.writeJSONSyncAbsolute(this.absoluteYyPath, this.rawDataFromYY);
  }
}

