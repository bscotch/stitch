import path from 'path';
import {
  existsSync,
  writeJSONSync,
  readJSONSync
} from 'fs-extra';
import { Project } from './Project';

export interface ConfigFileContents {
  "textureFolderAssignments": {
    [textureName:string]: string[]
  }
}

export class Config {
  private _fileContents: ConfigFileContents = {
    "textureFolderAssignments": {}
  }
  private _dir: string;

  constructor(project:Project){
    this._dir = project.dir;
    this.load();
  }

  get path() {
    return path.join(this._dir, "gms2-tools.json");
  }

  commit() {
    writeJSONSync(this.path, this._fileContents, {spaces:2});
  }

  get textureGroupsByFolder() {
    const folderTextureGroups: {[folder:string]:string} = {};
    for (const textureGroupName of Object.keys(this.textureFolderAssignments)) {
      for (const folder of this.textureFolderAssignments[textureGroupName]) {
        folderTextureGroups[folder] = textureGroupName;
      }
    }
    return folderTextureGroups;
  }

  get textureFolderAssignments() {
    return this._fileContents.textureFolderAssignments;
  }

  assignFolderToTextureGroup(folderPath: string, textureGroupName: string) {
    folderPath = folderPath.toLowerCase();
    if (!folderPath.startsWith("sprites")) {
      folderPath = "sprites/" + folderPath;
    }
    textureGroupName = textureGroupName.toLowerCase();
    this.removeFolderFromTextureGroups(folderPath);
    this.textureFolderAssignments[textureGroupName] = this.textureFolderAssignments[textureGroupName] || [];
    if (!this.textureFolderAssignments[textureGroupName].includes(folderPath)) {
      this.textureFolderAssignments[textureGroupName].push(folderPath);
      this.commit();
    }
  }

  removeTextureGroup(textureName: string) {
    const textureFolders = this._fileContents.textureFolderAssignments;
    Reflect.deleteProperty(textureFolders, textureName);
    this.commit();
  }

  removeFolderFromTextureGroups(folderPath: string) {
    folderPath = folderPath.toLowerCase();
    const textureFolders = this._fileContents.textureFolderAssignments;
    for (const textureName of Object.keys(textureFolders)) {
      if (textureFolders[textureName].includes(folderPath)) {
        textureFolders[textureName] = textureFolders[textureName].filter(function(folder){
          return (folder != folderPath);
        });
        if (textureFolders[textureName].length == 0) {
          Reflect.deleteProperty(textureFolders, textureName);
        }
      }
    }
    this.commit();
  }

  load(){
    if (!existsSync(this.path)) {
      this.commit();
    }
    this._fileContents = readJSONSync(this.path);
  }
}