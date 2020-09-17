import { Gms2PipelineError, assert } from "./errors";
import fs from "./files";
import { oneline } from "./strings";
import paths from "./paths";
import { YypComponents } from "../types/YypComponents";
import { Gms2ProjectComponents } from "../types/Gms2ProjectComponents";
import { Gms2Option } from "./components/Gms2Option";
import { Gms2Config } from "./components/Gms2Config";
import { Gms2Folder } from "./components/Gms2Folder";
import { Gms2RoomOrder } from "./components/Gms2RoomOrder";
import { Gms2TextureGroup } from './components/Gms2TextureGroup';
import { Gms2AudioGroup } from './components/Gms2AudioGroup';
import { Gms2ComponentArray } from "./components/Gms2ComponentArray";
import { Gms2ResourceArray } from "./components/Gms2ResourceArray";
import { Gms2Storage } from "./Gms2Storage";
import { Gms2ProjectConfig } from "./Gms2ProjectConfig";
import { Gms2Sprite } from "./components/resources/Gms2Sprite";
import { Gms2Sound } from "./components/resources/Gms2Sound";
import { Gms2FolderArray } from "./Gms2FolderArray";
import { Gms2ModuleImporter } from "./Gms2ModuleImporter";
import { Gms2ComponentArrayWithStorage } from "./components/Gms2ComponentArrayWithStorage";
import { Gms2IncludedFile } from "./components/Gms2IncludedFile";
import { Gms2IncludedFileArray } from "./components/Gms2IncludedFileArray";

export interface Gms2ProjectOptions {
  /**
   * Path to a directory in which a .yyp file can be
   * found, or directly to a .yyp file. If not set,
   * will recurse through deeper folders and attempt
   * to find a *single* .yyp file.
   */
  projectPath?: string,
  /**
   * Prevent any files from being written by
   * locking the project instance. Cannot be unlocked.
   */
  readOnly?: boolean,
}

/**
 * Convert a Gamemaker Studio 2.3+ project
 * into an internal representation that can
 * be manipulated programmatically.
 */
export class Gms2Project {

  /**
   * The content of the YYP file, mirroring the data structure
   * in the file but with components replaced by model instances.
   */
  private components!: Gms2ProjectComponents;
  private config: Gms2ProjectConfig;
  readonly storage: Gms2Storage;

  /**
   * @param {Gms2ProjectOptions|string} [options] An options object or the path
   * to the .yyp file or a parent folder containing it. If not specified, will
   * look in the current directory and all children.
   */
  constructor(options?: Gms2ProjectOptions | string) {
    // Normalize options
    options = {
      projectPath: typeof options == 'string'
        ? options
        : options?.projectPath || process.cwd(),
      readOnly: (typeof options != 'string' && options?.readOnly) || false
    };

    // Find the yyp filepath
    let yypPath = options.projectPath as string;
    if (!yypPath.endsWith(".yyp")) {
      const yypParentPath = yypPath;
      const yypPaths = fs.listFilesByExtensionSync(yypParentPath, 'yyp', true);
      if (yypPaths.length == 0) {
        throw new Gms2PipelineError(
          "Couldn't find the .yyp file in this project."
        );
      }
      if (yypPaths.length > 1) {
        throw new Gms2PipelineError(oneline`
          Found multiple .yyp files in the project.
          When more than one is present,
          you must specify which you want to use.
        `);
      }
      yypPath = yypPaths[0];
    }
    // Ensure the YYP file actually exists
    assert(fs.existsSync(yypPath), `YYP file does not exist: ${yypPath}`);

    // Load up all the project files into class instances for manipulation
    this.storage = new Gms2Storage(paths.resolve(yypPath),options.readOnly as boolean);
    this.config = new Gms2ProjectConfig(this.storage);
    this.reload();
  }

  get yypAbsolutePath(){
    return this.storage.yypAbsolutePath;
  }

  get folders(){
    return this.components.Folders;
  }

  get resources(){
    return this.components.resources;
  }

  get textureGroups(){
    return this.components.TextureGroups;
  }

  get audioGroups(){
    return this.components.AudioGroups;
  }

  get includedFiles(){
    return this.components.IncludedFiles;
  }

  get configs(){
    return this.components.configs;
  }

  /**
   * Import modules from one GMS2 project into this one.
   * @param fromProject A directory containing a single .yyp file somwhere, or the path directly to a .yyp file.
   */
  importModules(fromProjectPath: string,moduleNames:string[]){
    const fromProject = new Gms2Project({projectPath:fromProjectPath,readOnly:true});
    const importer = new Gms2ModuleImporter(fromProject,this);
    importer.importModules(moduleNames);
  }

  /** Ensure that a texture group exists in the project. */
  addTextureGroup(textureGroupName:string){
    this.components.TextureGroups.addIfNew({
      ...Gms2TextureGroup.defaultDataValues,
      name:textureGroupName
    },'name',textureGroupName) && this.save(); // So only save if changed
    return this.save();
  }

  /** Add a texture group assignment if it doesn't already exist. */
  addTextureGroupAssignment(folder:string,textureGroupName:string){
    this.config.addTextureGroupAssignment(folder,textureGroupName);
    this.setTextureGroupsUsingConfig();
    return this;
  }

  /**
   * Ensure that the texture groups used in the config all exist, and
   * that sprites are properly assigned to them. (This must generally be re-run
   * on configuration upate, since cannot handle inheritance with singleton updates.)
   */
  private setTextureGroupsUsingConfig(){
    for(const textureGroupName of this.config.textureGroupsWithAssignedFolders){
      this.addTextureGroup(textureGroupName);
    }
    // Ensure sprites are assigned to correct config texture groups
    for(const folder of this.config.foldersWithAssignedTextureGroups){
      this.components.resources
        .filterByClassAndFolder(Gms2Sprite,folder)
        .forEach(sprite=>sprite.textureGroup=this.config.textureGroupAssignments[folder]);
    }
    return this;
  }

  /** Ensure an audio group exists in the project */
  addAudioGroup(audioGroupName:string){
    this.components.AudioGroups.addIfNew({
      ...Gms2AudioGroup.defaultDataValues,
      name:audioGroupName
    },'name',audioGroupName) && this.save(); // So only save if changed
    return this;
  }

  /** Add a texture group assignment if it doesn't already exist. */
  addAudioGroupAssignment(folder:string,audioGroupName:string){
    this.config.addAudioGroupAssignment(folder,audioGroupName);
    this.setAudioGroupsUsingConfig();
    return this;
  }

  /**
   * Ensure that the Sound assets have their Audio Groups correctly
   * assigned based on the config file. (This must generally be re-run
   * on configuration upate, since cannot handle inheritance with singleton updates.)
   */
  private setAudioGroupsUsingConfig(){
    for(const audioGroupName of this.config.audioGroupsWithAssignedFolders){
      this.addAudioGroup(audioGroupName);
    }
    // Ensure sounds are assigned to correct config audio groups
    for(const folder of this.config.foldersWithAssignedAudioGroups){
      this.components.resources
        .filterByClassAndFolder(Gms2Sound,folder)
        .forEach(sprite=>sprite.audioGroup=this.config.audioGroupAssignments[folder]);
    }
    return this;
  }

  /**
   * Ensure that a folder path exists, so that assets can be assigned to it.
   */
  addFolder(path:string,tags?:string[]){
    // Clean up messy seperators
    path = path.replace(/[/\\]+/,'/')
      .replace(/^\//,'')
      .replace(/\/$/,'');
    // Get all subpaths
    const heirarchy = paths.heirarchy(path);
    for(const subPath of heirarchy){
      this.folders.addIfNew({
        ...Gms2Folder.defaultDataValues,
        name: Gms2Folder.nameFromPath(subPath),
        folderPath: Gms2Folder.folderPathFromPath(subPath),
        tags: tags || [],
      },'path',subPath);
    }
    this.save();
    return this;
  }

  /**
   * Add or update an audio file. The name is taken from
   * the sourcePath. If there already exists a sound asset
   * with this name, its file will be replaced. Otherwise
   * the asset will be created and placed into folder "/NEW".
   */
  addSound(sourcePath:string){
    this.resources.addSound(sourcePath,this.storage);
    this.save();
    return this;
  }

  /**
   * Import a new IncludedFile based on an external file.
   * By default will appear in "datafiles" root folder, but you can specificy
   * a subdirectory path. If an included file with this name already exists
   * in **ANY** subdirectory it will be overwritten. (Names must be unique due to
   * an iOS bug wherein all included files are effectively in a flat heirarchy.
   * see {@link https://docs2.yoyogames.com/source/_build/3_scripting/4_gml_reference/sprites/sprite_add.html}
   * @param path Direct filepath or a directory from which all files (recursively) should be loaded
   * @param content If set, will create a new file instead of copying content from an existing one.
   *                If the content is a string or buffer it will be written as-is. All other cases are
   *                JSON stringified. Must not be null or undefined in order to take effect.
   * @param subdirectory Subdirectory inside the Datafiles folder in which to place this resource.
   */
  addIncludedFile(path:string,content?:any,subdirectory?:string){
    return Gms2IncludedFile.import(this,path,content,subdirectory);
  }

  addConfig(name:string){
    if( ! this.components.configs.findChild(name)){
      this.components.configs.addChild(name);
      this.save();
    }
  }

  /** Write *any* changes to disk. (Does nothing if readonly is true.) */
  save(){
    this.storage.saveJson(this.yypAbsolutePath,this.dehydrated);
    return this;
  }

  ensureResourceGroupAssignments(){
    return this.setTextureGroupsUsingConfig()
      .setAudioGroupsUsingConfig();
  }

  /**
   * Recreate in-memory representations of the Gamemaker Project
   * using its files.
   */
  private reload() {
    // Load the YYP file, store RAW (ensure field resourceType: "GMProject" exists)
    const yyp = fs.readJsonSync(this.storage.yypAbsolutePath) as YypComponents;
    assert(yyp.resourceType == 'GMProject', 'This is not a GMS2.3+ project.');

    this.components = {
      ...yyp,
      Options: new Gms2ComponentArray(yyp.Options, Gms2Option),
      configs: new Gms2Config(yyp.configs),
      Folders: new Gms2FolderArray(yyp.Folders),
      RoomOrder: new Gms2ComponentArray(yyp.RoomOrder, Gms2RoomOrder),
      TextureGroups: new Gms2ComponentArray(yyp.TextureGroups, Gms2TextureGroup),
      AudioGroups: new Gms2ComponentArray(yyp.AudioGroups, Gms2AudioGroup),
      IncludedFiles: new Gms2IncludedFileArray(yyp.IncludedFiles,this.storage),
      resources: new Gms2ResourceArray(yyp.resources,this.storage)
    };

    this.ensureResourceGroupAssignments()
      .addFolder('NEW'); // Imported assets should go into a NEW folder.

    // DEBORK
    // TODO: Ensure that parent groups (folders) for all subgroups exist as separate entities.
    // TODO: Remove duplicate datafile entries (these dupe on every boot)
  }

  /**
   * The project's YYP content with everything as plain primitives (no custom class instances).
   * Perfect for writing to JSON.
   */
  get dehydrated(): YypComponents {
    const fields = Object.keys(this.components) as (keyof YypComponents)[];
    const asObject: Partial<YypComponents> = {};
    for (const field of fields) {
      const components = this.components[field];
      if( components instanceof Gms2ComponentArray ||
          components instanceof Gms2ResourceArray ||
          components instanceof Gms2Option){
        // @ts-ignore (Bonus points to anyone who can do this concisely without a ts-ignore!)
        asObject[field] = components.dehydrated;
      }
      else{
        const component = this.components[field] as any;
        asObject[field] = component?.dehydrated ?? component;
      }
    }
    return asObject as YypComponents;
  }
}

