// Top-level object for managing a YYP project
import {
  existsSync,
  readFileSync,
  ensureDirSync,
  copyFileSync,
  writeFileSync,
} from 'fs-extra';

import path from 'path';
// Resources
import {RawYYP, RawResource} from "./types/project";
import {Resource} from "./resources/Resource";
import {IncludedFile} from "./resources/IncludedFile";
import {Sound} from './resources/Sound';
import {View, ResourceType} from './resources/View';
import {ResourceSubclass} from "./types/resources";
import {Sprite} from './resources/Sprite';
import {Note} from "./resources/Note";


import {v4 as uuidV4} from "uuid";
import {
  startStep,
  assert,
  info
} from "./lib/messages";
import {Constructable} from "./types/util";
import {TextureGroup,TextureGroupFileContent} from "./types/texturegroup";
import cloneDeep from "lodash/cloneDeep";
import {Config} from "./Config";
import klawSync from 'klaw-sync';
import { differenceBy } from 'lodash';
import json from "./lib/json";

type klawFile = {path:string};

/**
 * Write as Windows-friendly JSON (with Windows EOL), since otherwise GMS2 will eventually
 * rewrite with Windows EOL and cause every line to show up as different in Git.
 */
function writeJSONSync(path:string,data:any){
  writeFileSync(path,json.stringify(data));
}

export interface ProjectConfig {
  /**
   * Path to a directory in which a .yyp file can be
   * found, or directly to a .yyp file.
   */
  projectPath?: string,
  /**
   * Prevent any files from being written by
   * locking the project instance. Cannot be unlocked.
   */
  locked?: boolean,
}


export class Project{

  readonly yypAbsolutePath: string;
  rawYypData: RawYYP = {resources: []};
  resources: Array<ResourceSubclass> = [];
  private _textureGroups: TextureGroup[] = [];
  private _config: Config;
  private _locked = false;

  /** @param {string} projectPath Path to directory containing the .yyp file for this project,
   * or the path to that file itself.*/
  constructor(options?: ProjectConfig | string){
    // Load the file as a javascript object
    options = {
      projectPath: typeof options == 'string'
        ? options
        : options?.projectPath || process.cwd(),
      locked: (typeof options != 'string' && options?.locked) || false
    };
    this.locked = options.locked as boolean;
    let yypPath = options.projectPath as string;
    if (!yypPath.endsWith(".yyp")) {
      const fileIsYYP = function(file: klawFile){
        return file.path.endsWith(".yyp");
      };
      const fileSearchOptions = {
        filter:fileIsYYP,
        traverseAll:true
      };
      const files = klawSync(yypPath, fileSearchOptions);
      if (files.length==0) {
        throw new Error("Couldn't find the .yyp file in this project.");
      }
      if (files.length>1) {
        throw new Error("Found multiple .yyp files in the project. Please specify.");
      }
      yypPath = files[0].path;
    }
    assert(path.extname(yypPath)=='.yyp',"Constructor requires full path of YYP file");
    assert(existsSync(yypPath),`YYP file does not exist: ${yypPath}`);
    this.yypAbsolutePath = path.resolve(yypPath);
    this._config = new Config(this);
    console.log("Loading project at ",this.yypAbsolutePath);
    this.load();
  }

  get locked(){ return this._locked; }
  /** Permanently disable saving. Useful for preventing accidental mutations. */
  set locked(locked:boolean){
    // Allow turning OFF but not ON
    if(!this._locked){
      this._locked = locked;
    }
  }

  /** The directory containing the .yyp file. */
  get dir(){
    return this.getRelativePath(path.dirname(this.yypAbsolutePath));
  }
  get path(){
    return this.getRelativePath(this.yypAbsolutePath);
  }

  /** Get texture assignments, according to gms2-tools.json config file. */
  get textureFolderAssignments() {
    return cloneDeep(this._config.textureFolderAssignments);
  }

  get absoluteDir(){
    return this.getAbsolutePath(this.dir);
  }

  get textureGroupsByFolder () {
    return this._config.textureGroupsByFolder;
  }

  get textureGroups() {
    return cloneDeep(this._textureGroups);
  }

  /** Path relative to the YYP project root */
  getRelativePath(to:string){
    return path.relative(path.dirname(this.yypAbsolutePath),to);
  }

  /** Absolute path, given a path relative to the YYP root */
  getAbsolutePath(relativePath:string){
    return path.join(path.dirname(this.yypAbsolutePath),relativePath);
  }

  getTextureByName(texName: string) {
    texName = texName.toLowerCase();
    for (const texGroup of this.textureGroups) {
      if (texGroup.name.toLowerCase() == texName) {
        return texGroup;
      }
    }
    // throw new Error(`Failed to find a texture group by the name ${texName}.`);
  }

  getViewByPath(viewPath: string) {
    viewPath = viewPath.toLowerCase();
    for (const view of this.views) {
      if (view.projectHeirarchyPath.toLowerCase() == viewPath) {
        return view;
      }
    }
    throw new Error(`Failed to find a view with the path ${viewPath}.`);
  }

  removeTextureGroupAssignments(textureName: string) {
    this._config.removeTextureGroup(textureName);
    this.updateAllSpriteTexturePages();
  }

  removeFolderFromTextureGroups(folderPath: string) {
    this._config.removeFolderFromTextureGroups(folderPath);
    this.updateAllSpriteTexturePages();
  }

  addFolderToTextureGroup(folderPath: string, textureGroupName: string) {
    this.getTextureByName(textureGroupName); // Will throw an error if the texture group doesn't exist.
    this._config.assignFolderToTextureGroup(folderPath, textureGroupName);
    this.updateAllSpriteTexturePages();
  }

  /**
   * Import modules from one GMS2 project into this one.
   * If using an existing Project instance, **beware** that
   * it will be mutated in strange ways!
   */
  importModules(fromProject: string|Project,moduleNames:string[]){
    if(!moduleNames.length){
      throw new Error("Must include at least one module name.");
    }
    fromProject = typeof fromProject == 'string'
      ? new Project({projectPath: fromProject,locked:true})
      : fromProject;
    const normalizedModuleNames = moduleNames.map(moduleName=>moduleName.toLocaleLowerCase());
    // Need to know all of the assets currently in module folders in this project,
    // so that after importing we can move anything that is no longer in the modules
    // into a safe space.
    const preExistingModuleAssets: {[moduleName:string]:ResourceSubclass[]} = {};
    for(const resource of this.resources.filter(resource=>resource.type!='GMFolder')){
      for(const moduleName of normalizedModuleNames){
        const pathParts = resource.view?.projectHeirarchyPathComponents.map(p=>p.toLocaleLowerCase());
        if(pathParts?.includes(moduleName)){
          preExistingModuleAssets[moduleName] = preExistingModuleAssets[moduleName] || [];
          preExistingModuleAssets[moduleName].push(resource);
        }
      }
    }

    const currentModuleAssets: {[moduleName:string]:ResourceSubclass[]} = {};
    for(const sourceView of fromProject.views){
      const matchingModule = normalizedModuleNames.find(name=>sourceView.name.toLocaleLowerCase()==name);
      if(matchingModule){
        // Then everything in this view (recursively) needs to be copied into the target.
        for(const child of sourceView.getChildren(undefined,true)){
          if(child.type!='GMFolder'){
            this.importResource(child);
            currentModuleAssets[matchingModule] = currentModuleAssets[matchingModule] || [];
            currentModuleAssets[matchingModule].push(child);
          }
        }
      }
    }

    // Move any pre-existing module assets whose names are no longer found into
    // top-level directories
    for(const module of normalizedModuleNames){
      const legacyAssets = differenceBy(preExistingModuleAssets[module],currentModuleAssets[module],'name');
      for(const legacyAsset of legacyAssets){
        const rootView = this.views.find(view=>{
          return view.projectHeirarchyPathComponents.length==1 &&
            view.projectHeirarchyPathComponents[0] == legacyAsset.view?.projectHeirarchyPathComponents[0];
        });
        if(rootView){
          legacyAsset.view?.removeChild(legacyAsset);
          rootView.addChild(legacyAsset);
          rootView.commit();
        }
      }
    }
  }

  private removeDeprecatedTextureGroups() {
    // Verify that all listed texture groups in the config exist in the project.
    const textureGroupNamesFromConfig = Object.keys(this.textureFolderAssignments);
    const textureGroupsInOptions = this.textureGroups.map(function(tgroup) {
      return tgroup.name.toLowerCase();
    });
    for (const tGroupName of textureGroupNamesFromConfig) {
      if (!textureGroupsInOptions.includes(tGroupName.toLowerCase())) {
        this.removeTextureGroupAssignments(tGroupName);
      }
    }
  }

  private updateAllSpriteTexturePages() {
    const folderTextures = this._config.textureGroupsByFolder;
    const folders = Object.keys(folderTextures);
    for (const folder of folders) {
      const textureId = this.getTextureByName(folderTextures[folder])?.id;
      if(textureId){
        folderTextures[folder] = textureId;
      }
    }
    // Sort folder by length.
    folders.sort(function(folderA,folderB){
      return (folderB.split("/").length - folderA.split("/").length);
    });
    for (const sprite of this.sprites) {
      // NOTHING
      const spritePathParts = sprite.projectHeirarchyPath.toLowerCase().split("/");
      for (const folderPath of folders) {
        const folderPathParts = folderPath.toLowerCase().split("/");
        if (spritePathParts.length >= folderPathParts.length) {
          let folderMatches = true;
          for (let i = 0; i < folderPathParts.length; i++){
            if (folderPathParts[i] != spritePathParts[i]) {
              folderMatches = false;
            }
          }
          if (folderMatches) {
            sprite.textureGroupID = folderTextures[folderPath];
            break;
          }
        }
      }
    }
  }

  /** Load the .yyp file and convert it into Project class representation */
  load(){
    // Load the file
    const contents = readFileSync(this.yypAbsolutePath,'utf8');
    try{
      this.rawYypData = json.parse(contents);
    }
    catch(err){
      throw new Error("YYP file was not JSON");
    }
    // Convert all of its components into objects
    // (resources are added to the project by the resource itself)
    this.resources = [];
    for(const resource of this.rawYypData.resources){
      this.createResourceInstance(resource);
    }
    // Convert all view references to their target objects
    for(const view of this.views){
      for(const childId of view.yy.children){
        // Find the resource that has this id
        const child = this.resources.find(resource=>resource.id==childId);
        if(child){
          view.addChild(child as Resource,false);
        }
        // else is probably an Options or other thing where the resource
        // does not live in the YYP file.
      }
    }

    //console.log("Loading options file");
    const optionsFilePath = path.join(this.absoluteDir, "options", "main", "inherited", "options_main.inherited.yy");
    if (!existsSync(optionsFilePath)) {
      throw new Error("The options file path doesn't exist.");
    }

    const optionsFileContents = readFileSync(optionsFilePath, "utf8");
    const probableJsonParts = optionsFileContents.match(/\|([^←]+)←/g);
    //console.log(probableJsonParts);
    if (!probableJsonParts) {
      throw new Error("There's probably nothing in this probable json parts!");
    }

    for (const part of probableJsonParts) {
      const cleanedPart = part.slice(1,part.length-1).trim();
      //console.log(json.parse(cleanedPart));
      try {
        const parsedPart: TextureGroupFileContent = json.parse(cleanedPart);
        if (parsedPart.textureGroups) {
          for (const group of parsedPart.textureGroups.Additions) {
            const textureGroup = {
              id:group.Value.id,
              name:group.Value.groupName
            };
            this._textureGroups.push(textureGroup);
          }
          break;
        }
      }
      catch(err){
        console.log(err);
      }
    }

    if (!this._textureGroups.length) {
      info("Note: No texture groups were found in the project.");
    }
    this.removeDeprecatedTextureGroups();
    this.updateAllSpriteTexturePages();
    //console.log("Final Texture Groups");
    //console.log(this._textureGroups);
  }

  /** Get all Sound objects in this project
   */
  get sounds(): Sound[]{
    return this.resources.filter((r): r is Sound=>{
      return r.type=='GMSound';
    });
  }

  /** Get all Sound objects in this project
   */
  get includedFiles(): IncludedFile[]{
    return this.resources.filter((r): r is IncludedFile=>{
      return r.type=='GMIncludedFile';
    });
  }

  /** Get all View objects in this project
   */
  get views(): View[]{
    return this.resources.filter((r): r is View=>{
      return r.type=='GMFolder';
    });
  }

  /** Get all Sprite objects in this project
   */
  get sprites(): Sprite[]{
    return this.resources.filter((r): r is Sprite=>{
      return r.type=='GMSprite';
    });
  }

  /** Get the root View object for this project */
  get rootView(): View{
    return this.views.filter(v=>v.isRoot)[0];
  }

  /** Write the current state of this Project as GMS2 */
  commit(){
    if(this.locked){ return; }
    const yyp = {...this.rawYypData};
    yyp.resources = this.resources.map(r=>r.rawResource);
    this.writeJSONSyncAbsolute(this.yypAbsolutePath,yyp);
  }

  /** Given a resourceType, return the javascript class
   * that can be used to manipulate it. */
  private getClassFromResourceType(resourceType: ResourceType) {
    const selector: {[resourceType in ResourceType]: Constructable<ResourceSubclass>} = {
      GMSound: Sound,
      GMFolder: View,
      GMSprite: Sprite,
      GMNotes: Note,
      GMPath: Resource,
      GMTimeline: Resource,
      GMOptions: Resource,
      GMExtension: Resource,
      GMShader: Resource,
      GMTileSet: Resource,
      GMIncludedFile: IncludedFile,
      GMConfig: Resource,
      GMObject: Resource,
      GMRoom: Resource,
      GMScript: Resource,
      GMFont: Resource
    };
    return selector[resourceType] || Resource;
  }

  /** Convert a raw YYP resource into a useful object
   * @param  {object} resource - An entry from the raw yyp.resources array
   */
  private createResourceInstance(resource: RawResource) {
    assert(resource,"resource does not exist");
    assert(resource.Value,"Value does not exist");
    assert(resource.Value.resourceType,"resourceType does not exist");
    const resourceClass = this.getClassFromResourceType(resource.Value.resourceType);
    return new resourceClass(this,resource) ;
  }

  /** Create nested views if they do not exist.
   * @param  {string} viewPath - E.g. sounds/enemy/bad_guy_1
   */
  ensureViewExists(viewPath: string){
    // Given a view in a folder structure (e.g. level1/level2/...)
    // make sure all views exist up to that point.
    const viewPathParts = viewPath.split(/[/\\]+/);
    assert(viewPathParts.length,"viewPath is required");
    // Ensure root is one of the allowed ones, and get its type
    const resourceType = View.rootNameToResourceType(viewPathParts[0]);
    assert(resourceType
      ,`View root ${viewPathParts[0]} does not correspond to a resource type`);
    // For each view in the path, make sure it exists
    let view = this.rootView;
    for(const viewPathPart of viewPathParts){
      const childViews = view.children.filter((child:ResourceSubclass)=>child.type=="GMFolder") as View[];
      const matchingChildView = childViews.find((child:View)=>child.name.toLowerCase()==viewPathPart.toLowerCase());
      view = matchingChildView ||
        View.create(this,resourceType,viewPathPart,view);
      view.commit();
    }
    return view;
  }

  /** Internalize a Resource from another project */
  private importResource(resourceObject: ResourceSubclass){
    // Before potentially changing the parent project, grab the 'associated' file locations
    const associatedFiles = resourceObject.associatedFiles
      .map(fullPath=>{
        return {
          absolutePath: fullPath,
          relativePath: resourceObject.project.getRelativePath(fullPath)
        };
      });
    resourceObject.project = this;

    // Check for matching resources
    const matchingResources = this.resources.filter(r=>{
      return r.id == resourceObject.id || r.name == resourceObject.name;
    });
    if(matchingResources.length == 1){
      resourceObject.id = matchingResources[0].id;
      resourceObject.name = matchingResources[0].name;
    }
    else if(matchingResources.length == 2){
      // Believe the name
      const matchingResource = matchingResources.find(r=>r.name==resourceObject.name) as ResourceSubclass;
      resourceObject.id = matchingResource.id;
    }
    else if(matchingResources.length > 2){
      throw new Error(`Somehow matched more than two existing resources for ${resourceObject.name} (${resourceObject.id})`);
    }
    else{
      this.resources.push(resourceObject);
      this.rawYypData.resources.push(resourceObject.rawResource);
    }

    // Get the resource added
    const rawResourceExists = this.rawYypData.resources.find(r=>r.Key==resourceObject.id);
    if(!rawResourceExists){
      this.rawYypData.resources.push(resourceObject.rawResource);
    }

    // Ensure the yy file and all associated files exist. It may from a different absolute path,
    // so need to use relative path from source against this project's root.
    for(const file of associatedFiles){
      const sourcePath = file.absolutePath;
      const targetPath = this.getAbsolutePath(file.relativePath);
      const dir = path.dirname(targetPath);
      ensureDirSync(dir);
      copyFileSync(sourcePath,targetPath);
    }
    ensureDirSync(this.getAbsolutePath(path.dirname(resourceObject.yyPath)));
    resourceObject.commit();
    // Make sure this resource appears in the view heirarchy
    const view = this.ensureViewExists(path.dirname(resourceObject.projectHeirarchyPath));

    view.addChild(resourceObject,true);
    this.commit();
  }

  upsertAudio(source:string){
    startStep(`Upserting audio ${source}`);
    const name = Sound.nameFromSource(source);
    if(this.sounds.find(sound=>sound.name==name)){
      info('already exists, replacing file');
      Sound.replaceSoundFile(this,source);
      return;
    }
    info('does not yet exist, creating resource');
    Sound.create(this,source);
  }

  /** Create a new IncludedFile resource based on an external file.
   * By default will appear in "datafiles" root folder, but you can specificy
   * a subdirectory path.
   * @param subdirectory Subdirectory inside the Datafiles folder in which to place this resource.
   */
  upsertIncludedFile(filePath:string,subdirectory?:string){
    const fileName = IncludedFile.nameFromSource(filePath);
    const existingResource = this.includedFiles.find(includedFile=>includedFile.name==fileName);
    if(existingResource){
      return existingResource.replaceIncludedFile(filePath);
    }
    else{
      return IncludedFile.create(this,filePath,subdirectory);
    }
  }

  /** Create a new IncludedFile resource based on a data blob.
   * By default will appear in "datafiles" root folder, but you can specificy
   * a subdirectory path.
   * @param fileName The desired name of the file you're creating (must not include a path)
   * @param subdirectory Subdirectory inside the Datafiles folder in which to place this resource.
   */
  upsertIncludedFileContent(fileName:string,content:Buffer|string,subdirectory?:string){
    if(path.basename(fileName) != fileName){
      throw new Error("File name must not include any directories.");
    }
    const existingResource = this.includedFiles.find(includedFile=>includedFile.name==fileName);
    if(existingResource){
      return existingResource.replaceIncludedFileContent(content);
    }
    else{
      return IncludedFile.createUsingBlob(this,fileName,content,subdirectory);
    }
  }

  writeJSONSync(relativePath:string,data:any){
    if(this.locked){ return; }
    writeJSONSync(this.getAbsolutePath(relativePath),data);
  }

  writeJSONSyncAbsolute(absolutePath:string,data:any){
    if(this.locked){ return; }
    writeJSONSync(absolutePath,data);
  }

  static createYYPResource(
    id:string,
    resourceType:string,
    resourcePath:string
  ){
    return {
      Key: id,
      Value:{
        id: uuidV4(),
        resourcePath: resourcePath,
        resourceType: resourceType
      }
    } as RawResource;
  }
}
