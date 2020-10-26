import { StitchError, assert } from "./errors";
import fs from "./files";
import { oneline } from "@bscotch/utility";
import paths from "./paths";
import { YypComponents } from "../types/Yyp";
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
import { Gms2IncludedFile } from "./components/Gms2IncludedFile";
import { Gms2IncludedFileArray } from "./components/Gms2IncludedFileArray";
import { SpritelyBatch } from "@bscotch/spritely";
import {snakeCase,camelCase,pascalCase} from "change-case";
import { logInfo } from "./log";

export interface SpriteImportOptions {
  /** Optionally prefix sprite names on import */
  prefix?: string,
  /** Enforce casing standards. Defaults to 'snake'. */
  case?: 'snake'|'camel'|'pascal',
  /**
   * Normally only the immediate parent folder containing
   * images is used as the sprite name. Optionally "flatten"
   * the parent folders up to the root (the root being
   * where the import started) to create the name. For example,
   * for `root/my/sprite/image.png` the flattened name would
   * be `my_sprite` (if using snake case).
   */
  flatten?: boolean
}

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
  /**
   * By default Gms2Project instances will throw an
   * error before doing anything when they are in an
   * unclean Git repo. This is to reduce the likelihood
   * of unrecoverable changes. You can turn off this
   * requirement, but you sure better know what you're
   * doing!
   */
  dangerouslyAllowDirtyWorkingDir?: boolean,
}

/**
 * Convert a GameMaker Studio 2.3+ project
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
      readOnly:
        (typeof options != 'string' && options?.readOnly) || false,
      dangerouslyAllowDirtyWorkingDir:
        (typeof options != 'string' && options?.dangerouslyAllowDirtyWorkingDir) || false,
    };

    // Find the yyp filepath
    let yypPath = options.projectPath as string;
    if (!yypPath.endsWith(".yyp")) {
      const yypParentPath = yypPath;
      const yypPaths = fs.listFilesByExtensionSync(yypParentPath, 'yyp', true);
      if (yypPaths.length == 0) {
        throw new StitchError(
          `Couldn't find a .yyp file in "${yypParentPath}"`
        );
      }
      if (yypPaths.length > 1) {
        throw new StitchError(oneline`
          Found multiple .yyp files in "${yypParentPath}".
          When more than one is present,
          you must specify which you want to use.
        `);
      }
      yypPath = yypPaths[0];
    }
    // Ensure the YYP file actually exists
    assert(fs.existsSync(yypPath), `YYP file does not exist: ${yypPath}`);

    // Load up all the project files into class instances for manipulation
    this.storage = new Gms2Storage(
      paths.resolve(yypPath),
      options.readOnly as boolean,
      options.dangerouslyAllowDirtyWorkingDir as boolean
    );
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

  private switchSearchRegex = new RegExp(`(?<pre><DisplayVersion>)(?<versionString>.*)(?<post></DisplayVersion>)`);

  private setSwitchVersion(normalizedVersionString:string, fileName: string){
    const oldContent = this.storage.readBlob(fileName).toString();
    const newContent = oldContent.replace(this.switchSearchRegex, `$1${normalizedVersionString}$3`);
    this.storage.writeBlob(fileName,newContent);
  }

  private getSwitchVersion(fileName: string){
    const content = this.storage.readBlob(fileName).toString();
    const newContent = content.match(this.switchSearchRegex)?.groups;
    if (newContent){
      return newContent["versionString"];
    }
    else{
      throw new StitchError(`Cannot parse the Switch *.nmeta file to obtain the version`);
    }
  }

  //Xbox key name follows a different pattern, hence the special treatment
  private xboxVersionKey = "option_xbone_version";

  /**
   * Set the project version in all options files.
   * (Note that the Switch options files do not include the version
   *  -- that must be set outside of GameMaker in the *.nmeta file).
   * Can use one of:
   *    + "0.0.0.0" syntax (exactly as GameMaker stores versions)
   *    + "0.0.0" syntax (semver without prereleases -- the 4th value will always be 0)
   *    + "0.0.0-rc.0" syntax (the 4th number will be the RC number)
   * The four numbers will appear in all cases as the string "major.minor.patch.candidate"
   */
  set version (versionString:string){
    const parts = versionString
      .match(/^(?<major>\d+)\.(?<minor>\d+)\.(?<patch>\d+)((\.(?<revision>\d+))|(-rc.(?<candidate>\d+)))?$/);
    if(!parts){
      throw new StitchError(`Version string ${versionString} is not a valid format.`);
    }
    const {major,minor,patch,revision,candidate} = parts.groups as {[part:string]:string};
    const normalizedVersionString = [major,minor,patch,candidate||revision||'0'].join('.');
    const optionsDir = paths.join(this.storage.yypDirAbsolute,'options');
    const optionsFiles = this.storage.listFiles(optionsDir,true, ["yy", "nmeta"]);
    for(const file of optionsFiles){
      // Load it, change the version, and save
      if (paths.extname(file) == ".yy"){
        const content = this.storage.readJson(file);
        const platform = paths.basename(paths.dirname(file)) as Gms2TargetPlatform;
        if(Gms2Project.platforms.includes(platform)){
          let versionKey = `option_${platform}_version`;
          if (platform == "xboxone"){
            versionKey = this.xboxVersionKey;
          }
          content[versionKey] = normalizedVersionString;
          this.storage.writeJson(file,content);
        }
      }
      // Switch *.nmeta file needs special treatment
      else if (paths.extname(file) == ".nmeta"){
        this.setSwitchVersion(normalizedVersionString, file);
      }
      else{
        throw new StitchError(`Found unsupported file format in the options dir: ${file}`);
      }
    }
  }

  versionOnPlatform(platform: Gms2TargetPlatform){
    const optionsDir = paths.join(this.storage.yypDirAbsolute,'options');
    if (platform != "switch"){
      const optionsFile = paths.join(optionsDir,platform,`options_${platform}.yy`);
      let versionKey = `option_${platform}_version`;
      if (platform == "xboxone"){
        versionKey = this.xboxVersionKey;
      }
      return this.storage.readJson(optionsFile)[versionKey] as string;
    }
    else{
      const optionsFile = this.storage.listFiles(optionsDir,true, ["nmeta"])?.[0];
      if (optionsFile){
        return this.getSwitchVersion(optionsFile);
      }
      else{
        throw new StitchError(`The project does not contain a valid *.nmeta file with version info.`);
      }
    }
  }

  /**
   * Import modules from one GMS2 project into this one.
   * @param fromProject A directory containing a single .yyp file somwhere, or the path directly to a .yyp file.
   */
  importModules(fromProjectPath: string,moduleNames:string[]){
    const fromProject = new Gms2Project({projectPath:fromProjectPath,readOnly:true});
    const importer = new Gms2ModuleImporter(fromProject,this);
    importer.importModules(moduleNames);
    return this;
  }

  /** Ensure that a texture group exists in the project. */
  addTextureGroup(textureGroupName:string){
    this.components.TextureGroups.addIfNew({
      ...Gms2TextureGroup.defaultDataValues,
      name:textureGroupName
    },'name',textureGroupName) && this.save(); // So only save if changed
    return this;
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

  static get supportedSoundFileExtensions() { return ["mp3","ogg","wav","wma"]; }

  private addSoundByFile(sourcePath:string){
    const fileExt = paths.extname(sourcePath).slice(1);
    assert(Gms2Project.supportedSoundFileExtensions.includes(fileExt), oneline`
      Cannot import sound file with extension: ${fileExt}.
      Only supports: ${Gms2Project.supportedSoundFileExtensions.join(",")}
      `);
    this.resources.addSound(sourcePath,this.storage);
    return this.save();
  }

  /**
   * Add or update audio files from a file or a directory.
   * The name is taken from
   * the sourcePath. If there already exists a sound asset
   * with this name, its file will be replaced. Otherwise
   * the asset will be created and placed into folder "/NEW".
   * Support the following extensions:
   * 1. mp3
   * 2. ogg
   * 3. wav
   * 4. wma
   * @param {string[]} [allowExtensions] Only allow defined extensions.
   * If not defined, will allow all supported extensions.
   */
  addSounds(sourcePath:string, allowExtensions?: string[]){
    if (!allowExtensions || allowExtensions.length == 0){
      allowExtensions = Gms2Project.supportedSoundFileExtensions;
    }
    for (const extension of allowExtensions){
      assert(Gms2Project.supportedSoundFileExtensions.includes(extension), oneline`
      Cannot batch import sound file with extension: ${extension}.
      Only supports: ${Gms2Project.supportedSoundFileExtensions.join(",")}
      `);
    }
    let targetFiles:string[] = [];
    if (fs.statSync(sourcePath).isFile()){
      targetFiles.push(sourcePath);
    }
    else{
      targetFiles = fs.listFilesByExtensionSync(sourcePath, allowExtensions, true);
    }
    for(const targetFile of targetFiles){
      this.addSoundByFile(targetFile);
    }
    return this;
  }

  /**
   * Add or update a script resource. Unless you're trying to make
   * global variables, your code should be wrapped in a function!
   */
  addScript(name:string,code:string){
    this.resources.addScript(name,code,this.storage);
    return this.save();
  }

  /**
   * Add or update a sprite resource, given a folder (sprite)
   * containing subimages (frames). Will use the folder name
   * as the sprite name. Completely replaces the images for
   * the target sprite, and frames are put in alphabetical order
   * by source name.
   */
  private addSprite(sourceFolder:string,nameOverride?:string){
    this.resources.addSprite(sourceFolder,this.storage,nameOverride);
    return this.save();
  }

  /**
   * Given a source folder that is either a sprite or a
   * a folder containing sprites (where a 'sprite' is a folder
   * containing one or more immediate child PNGs that are
   * all the same size -- nesting is allowed), add or update
   * the game project sprites using those images. This completely
   * replaces the existing images for that sprite. The folder
   * name is used directly as the sprite name (parent folders
   * are ignored for this.)
   */
  addSprites(sourceFolder:string, options?: SpriteImportOptions){
    const spriteBatch = new SpritelyBatch(sourceFolder);
    const sprites = spriteBatch.sprites;
    assert(sprites.length,`No sprites found in ${sourceFolder}`);
    for(const sprite of sprites){
      let name = options?.flatten
        ? paths.relative(sourceFolder,sprite.path)
        : paths.subfolderName(sprite.path);
      name = name.replace(/[.\\/]/g,' ')
        .replace(/\s+/,' ')
        .trim();
      const casing = options?.case || 'snake';
      const casedName = (casing=='snake' && snakeCase(name)) ||
        (casing=='camel' && camelCase(name)) ||
        (casing=='pascal' && pascalCase(name)) ||
        '';
      assert(casedName,`could not convert ${name} to ${casing} case`);
      this.addSprite(sprite.path,`${options?.prefix||''}${casedName}`);
    }
    return this;
  }

  addObject(name:string){
    this.resources.addObject(name,this.storage);
    return this.save();
  }

  deleteResourceByName(name:string){
    this.resources.deleteByName(name);
    return this.save();
  }

  deleteIncludedFileByName(baseName:string){
    this.includedFiles.deleteByName(baseName);
    return this.save();
  }

  /**
   * Import a new IncludedFile based on an external file.
   * By default will appear in "datafiles/NEW" folder, but you can specificy
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
  addIncludedFiles(path:string,options?:{content?:any,subdirectory?:string, allowedExtensions?:string[]}){
    const file = Gms2IncludedFile.import(this,path,options?.content,options?.subdirectory, options?.allowedExtensions);
    logInfo(`upserted file ${path}`);
    return file;
  }

  addConfig(name:string){
    if( ! this.components.configs.findChild(name)){
      this.components.configs.addChild(name);
      this.save();
    }
    return this;
  }

  /** Write *any* changes to disk. (Does nothing if readonly is true.) */
  save(){
    this.storage.writeJson(this.yypAbsolutePath,this.dehydrated);
    return this;
  }

  ensureResourceGroupAssignments(){
    return this.setTextureGroupsUsingConfig()
      .setAudioGroupsUsingConfig();
  }

  /**
   * Recreate in-memory representations of the GameMaker Project
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
   * A deep copy of the project's YYP content with everything as plain primitives (no custom class instances).
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

  static get platforms(){
    return [
      'amazonfire',
      'android',
      'html5',
      'ios',
      'linux',
      'mac',
      'ps4',
      'switch',
      'tvos',
      'windows',
      'windowsuap',
      'xboxone'
    ] as const;
  }
}

export type Gms2TargetPlatform = typeof Gms2Project.platforms[number];
