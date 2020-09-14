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
import { Gms2IncludedFile } from "./components/Gms2IncludedFile";
import { Gms2ComponentArray } from "./components/Gms2ComponentArray";
import { Gms2ResourceArray } from "./components/Gms2ResourceArray";
import { Gms2Storage } from "./Gms2Storage";

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
  #components!: Gms2ProjectComponents;

  #storage: Gms2Storage;

  /**
   * @param {Gms2Config|string} [options] An options object or the path
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
    this.#storage = new Gms2Storage(paths.resolve(yypPath),options.readOnly as boolean);
    this.reload();
  }

  get yypAbsolutePath(){
    return this.#storage.yypAbsolutePath;
  }

  get folders(){
    return this.#components.Folders;
  }

  get resources(){
    return this.#components.resources;
  }

  /**
   * Recreate in-memory representations of the Gamemaker Project
   * using its files.
   */
  reload() {
    // Load the YYP file, store RAW (ensure field resourceType: "GMProject" exists)
    const yyp = fs.readJsonSync(this.#storage.yypAbsolutePath) as YypComponents;
    assert(yyp.resourceType == 'GMProject', 'This is not a GMS2.3+ project.');

    this.#components = {
      ...yyp,
      Options: new Gms2ComponentArray(yyp.Options, Gms2Option),
      configs: new Gms2Config(yyp.configs),
      Folders: new Gms2ComponentArray(yyp.Folders, Gms2Folder),
      RoomOrder: new Gms2ComponentArray(yyp.RoomOrder, Gms2RoomOrder),
      TextureGroups: new Gms2ComponentArray(yyp.TextureGroups, Gms2TextureGroup),
      AudioGroups: new Gms2ComponentArray(yyp.AudioGroups, Gms2AudioGroup),
      IncludedFiles: new Gms2ComponentArray(yyp.IncludedFiles, Gms2IncludedFile),
      resources: new Gms2ResourceArray(yyp.resources,this.#storage)
    };

    // DEBORK
    // TODO: Ensure that parent groups (folders) for all subgroups exist as separate entities.
    // TODO: Remove duplicate datafile entries (these dupe on every boot)

    // TODO: Make it so that we can actually load an save a project file.

    // Ensure that the 'NEW' folder exists for imported assets.
    this.ensureFolder('NEW');
  }

  /**
   * Ensure that a folder path exists, so that assets can be assigned to it.
   */
  ensureFolder(path:string,tags?:string[]){
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
    this._save();
  }

  /**
   * Add or update an audio file. The name is taken from
   * the sourcePath. If there already exists a sound asset
   * with this name, its file will be replaced. Otherwise
   * the asset will be created and placed into folder "/NEW".
   */
  upsertSound(sourcePath:string){
    // Ensure that the sound file exists
    // Get the name of the sound file
    // See if a sound by that name already exists
    //    Yes: Just copy the file over the old one
    //    No: Create a new sound resource
    // Save the .yy
    // Save the .yyp
  }

  /** Write *any* changes to disk. (Does nothing if readonly is true.) */
  private _save(){
    if(this.#storage.isReadOnly){
      return;
    }
    // TODO: Add saving logic (will need to cascade through all resources)
  }

  get dehydrated(): YypComponents {
    const fields = Object.keys(this.#components) as (keyof YypComponents)[];
    const asObject: Partial<YypComponents> = {};
    for (const field of fields) {
      const components = this.#components[field];
      if( components instanceof Gms2ComponentArray ||
          components instanceof Gms2ResourceArray ||
          components instanceof Gms2Option){
        // @ts-ignore
        asObject[field] = components.dehydrated;
      }
      else{
        const component = this.#components[field] as any;
        asObject[field] = component?.dehydrated ?? component;
      }
    }
    return asObject as YypComponents;
  }
}

