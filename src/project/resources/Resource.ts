// For resources that are not yet being parsed
// import cloneDeep from 'lodash/cloneDeep';
// import path from 'path';
import assert from 'assert';
import {Project} from '../Project';
import type {RawResource} from "../types/project";
import {View,ResourceType} from './View';
import path from "path";
import klaw from "klaw-sync";
import flat from "flat";
import json from '../lib/json';

export class Resource{
  readonly type: ResourceType|null;
  protected _id: string;
  protected parent: View|null = null;
  protected _name: string;
  dir: string;
  yyPath: string;
  yy: any;
  protected _project: Project;

  constructor( project:Project,
    readonly rawResource: RawResource,
    resourceType:ResourceType|null = null
  ){
    this._project = project;
    this.type = resourceType;
    assert(rawResource.Key,"Resource Key does not exist");
    assert(rawResource.Value,"Resource Value does not exist");
    if(resourceType){
      assert(rawResource.Value.resourceType==resourceType);
    }
    this.yyPath = path.join(rawResource.Value.resourcePath);
    try{
      this.yy = json.readFileSync(this.absoluteYyPath);
    }
    catch(err){
      // Swallow this: not all resources use this same way of finding yy files.
    }
    this.dir = path.join(rawResource.Value.resourcePath.replace(/[^/\\]*$/, ""));
    this._name = rawResource.Value.resourcePath.replace(/^.*[/\\]/, "").replace(/\.yy$/, "");
    this._id = rawResource.Key;
    this.addToProject();
  }

  get name(){ return this._name; }
  set name(name:string){
    // Update the private variable and the yy data
    const oldName = this._name;
    this._name = name;
    this.yy.name = name;
    // There may be other fields whose value match the old name
    if(oldName){
      const flattenedYy = flat.flatten(this.yy) as {[key:string]:any};
      for(const key of Object.keys(flattenedYy)){
        if(flattenedYy[key] == oldName){
          flattenedYy[key] = name;
        }
      }
      this.yy = flat.unflatten(flattenedYy);
    }
  }

  get id(){ return this._id; }
  set id(id:string){
    // Update the private variable and the yy data
    const oldId = this._id;
    this._id = id;
    this.yy.id = id;
    // There may be other fields who value match the old id
    if(oldId){
      const flattenedYy = flat.flatten(this.yy) as {[key:string]:any};
      for(const key of Object.keys(flattenedYy)){
        if(flattenedYy[key] == oldId){
          flattenedYy[key] = id;
        }
      }
      this.yy = flat.unflatten(flattenedYy);
    }
    if(this.id.length != 36){
      throw new Error(`Attempting to set id to ${id}`)
    }
  }

  set project(project:Project){
    this._project = project;
  }
  get project(){
    return this._project;
  }
  /** Get all files, except the .yy file, associated with this resource */
  get associatedFiles(){
    const files = klaw(this.absoluteDir,{nodir:true});
    return files.map(file=>file.path).filter(file=>!file.endsWith('.yy'));
  }

  get absoluteYyPath(){
    return this.project.getAbsolutePath(this.yyPath);
  }

  get absoluteDir(){
    return this.project.getAbsolutePath(this.dir);
  }

  set view(view){
    this.parent = view;
  }

  get view(){
    return this.parent;
  }

  get projectHeirarchyPathComponents(){
    const currentHeirarchy = [this.name];
    if (this.parent && !this.parent.isRoot) {
      let currentView = this.parent;
      // eslint-disable-next-line no-constant-condition
      while (true) {
        if (currentView.isRoot) {
          break;
        }
        if (!currentView.parent) {
          throw new Error("View parent was missing.");
        }
        currentHeirarchy.unshift(currentView.name);
        currentView = currentView.parent;
      }
    }
    return currentHeirarchy;
  }

  get projectHeirarchyPath() {
    return this.projectHeirarchyPathComponents.join("/");
  }

  commit(){
    this.project.writeJSONSyncAbsolute(this.absoluteYyPath,this.yy);
  }

  private addToProject(){
    const resourceExists = this.project.resources.find(r=>{
      return r.id == this.id;
    });
    if(!resourceExists){
      this.project.resources.push(this);
      this.project.yyp.resources.push(this.rawResource);
    }
    const rawResourceExists = this.project.yyp.resources.find(r=>r.Key==this.id);
    if(!rawResourceExists){
      this.project.yyp.resources.push(this.rawResource);
    }
  }

  static nameFromSource(source:string){
    return path.parse(source).name;
  }
}

