import assert from 'assert';
import cloneDeep from 'lodash/cloneDeep';
import { join } from 'path';
import {Resource} from './Resource';
import {v4 as uuidV4} from "uuid";
import {viewTemplateType,viewTemplate} from './templates/view';
import {Project} from '../Project';
import {RawResource} from "../types/project";
import { ResourceSubclass } from '../types/resources';
import json from "../lib/json";

const rootNamesByResourceType = {
  GMConfig: "configs",
  GMExtension: 'extensions',
  GMFolder: "views",
  GMFont: "fonts",
  GMIncludedFile: 'datafiles',
  GMNotes: 'notes',
  GMObject: "objects",
  GMOptions: 'options',
  GMPath: 'paths',
  GMRoom: "rooms",
  GMScript: 'scripts',
  GMShader: 'shaders',
  GMSound: 'sounds',
  GMSprite: 'sprites',
  GMTileSet: 'tilesets',
  GMTimeline: 'timelines',
};

export type ResourceType = keyof typeof rootNamesByResourceType;

const resourceTypeByRootNames: {[rootName:string]:ResourceType} = {};
for(const type of (Object.keys(rootNamesByResourceType) as ResourceType[])){
  resourceTypeByRootNames[rootNamesByResourceType[type]] = type;
}

export class View extends Resource{
  readonly dir: string;
  readonly yy: viewTemplateType;
  readonly children: ResourceSubclass[];
  readonly isRoot: boolean;

  constructor(project:Project, resource:RawResource){
    super(project,resource,'GMFolder');
    this.dir = join(project.dir,'views');
    this.yyPath = join(this.dir,`${this.id}.yy`);
    try{
      json.readFileSync(this.absoluteYyPath);
    }
    catch(err){
      console.log(err);
    }
    this.yy = json.readFileSync(this.absoluteYyPath);
    this.id = this.yy.id;
    this.name = this.yy.folderName;
    this.children = [];
    this.isRoot = this.yy.filterType == 'root';
  }

  get name(){ return this._name; }
  set name(name:string){
    this._name = name;
    this.yy.folderName = name;
  }

  addChild(child: Resource, force?:boolean){
    // Add child object if its ID is in the yyPath (or if forced)
    const isAlreadyChild = this.yy.children.includes(child.id);
    const childExistsAsObject = isAlreadyChild &&
      this.children.find(c=>c.id==child.id);
    if(!childExistsAsObject && (force || isAlreadyChild)){
      this.children.push(child);
      child.view = this;
      if(force && !isAlreadyChild){
        // Then this is a new child -- write to disk!
        this.commit();
      }
    }
  }

  /** Remove a child from this View (setting it's 'view' to null). */
  removeChild(child: Resource){
    const childIndex = this.children.findIndex(c=>c.id==child.id);
    if(childIndex > -1){
      child.view = null;
      this.children.splice(childIndex,1);
      this.commit();
    }
  }

  getChildren(resourceType?: ResourceType, recursive?: boolean) {
    const children = this.children;
    const matchingChildren: Resource[] = [];
    for (const child of children) {
      if (!resourceType || child.type == resourceType) {
        matchingChildren.push(child);
      }
      if (recursive && child.type == "GMFolder") {
        const subChildren = (child as View).getChildren(resourceType, recursive);
        matchingChildren.push(...subChildren);
      }
    }
    return matchingChildren;
  }

  commit(){
    const yy = {...this.yy};
    if(this.children.length){
      yy.children = this.children.map(child=>child.id);
    }
    this.project.writeJSONSyncAbsolute(this.absoluteYyPath,yy);
  }

  static resourceTypeToRootName(resourceType:ResourceType){
    return rootNamesByResourceType[resourceType];
  }

  static rootNameToResourceType(name:string){
    return resourceTypeByRootNames[name];
  }

  static create(
    project:Project,
    resourceType:string,
    name:string,
    parentView:View
  ){
    assert(project&&resourceType&&name&&parentView,"Missing an argument");
    // Fill out the yy file
    const key = uuidV4();
    const yy = cloneDeep(viewTemplate);
    yy.id = key;
    yy.name = key;
    yy.folderName = name;
    yy.filterType = resourceType;
    const absoluteYyPath = project.getAbsolutePath(join('views',`${key}.yy`));
    project.writeJSONSyncAbsolute(absoluteYyPath,yy);
    // Create the View object
    const view = new View(
      project,
      Project.createYYPResource(key,"GMFolder",`views\\${key}.yy`)
    );
    // Add the new view to its parent
    parentView.addChild(view,true);
    project.commit();
    return view;
  }
}
