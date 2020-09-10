import {Gms2PipelineError,assert} from "./errors";
import fs from "./files";
import {oneline} from "./strings";
import paths from "./paths";
import { YypComponents } from "../types/YypComponents";
import { Gms2ProjectComponents } from "../types/Gms2ProjectComponents";
import { Gms2ProjectOption } from "./components/Gms2ProjectOption";
import { Gms2ProjectConfig } from "./components/Gms2ProjectConfig";
import { Gms2ProjectFolder } from "./components/Gms2ProjectFolder";
import { Gms2ProjectRoomOrder } from "./components/Gms2ProjectRoomOrder";
import {Gms2ProjectTextureGroup} from './components/Gms2ProjectTextureGroup';
import {Gms2ProjectAudioGroup} from './components/Gms2ProjectAudioGroup';
import {hydrateArray} from "./hydrate";

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

  readonly yypAbsolutePath:string;
  readonly isReadOnly:boolean;

  /** Directory containing a .git file. null means no repo, undefined means no check has occurred. */
  #gitRepoDirectory: string|null|undefined;

  /**
   * The content of the YYP file, mirroring the data structure
   * in the file but with components replaced by model instances.
   */
  #components!: Gms2ProjectComponents;

  /**
   * @param {Gms2ProjectConfig|string} [options] An options object or the path
   * to the .yyp file or a parent folder containing it. If not specified, will
   * look in the current directory and all children.
   */
  constructor(options?:Gms2ProjectOptions|string){
    // Normalize options
    options = {
      projectPath: typeof options == 'string'
        ? options
        : options?.projectPath || process.cwd(),
      readOnly: (typeof options != 'string' && options?.readOnly) || false
    };
    this.isReadOnly = options.readOnly as boolean;

    // Find the yyp filepath
    let yypPath = options.projectPath as string;
    if (!yypPath.endsWith(".yyp")) {
      const yypParentPath = yypPath;
      const yypPaths = fs.listFilesByExtensionSync(yypParentPath,'yyp',true);
      if (yypPaths.length==0) {
        throw new Gms2PipelineError(
          "Couldn't find the .yyp file in this project."
        );
      }
      if (yypPaths.length>1) {
        throw new Gms2PipelineError(oneline`
          Found multiple .yyp files in the project.
          When more than one is present,
          you must specify which you want to use.
        `);
      }
      yypPath = yypPath[0];
    }

    // Ensure the YYP file actually exists
    assert(fs.existsSync(yypPath),`YYP file does not exist: ${yypPath}`);
    this.yypAbsolutePath = paths.resolve(yypPath);

    // Require that the project is within a Git repo
    assert(this.gitRepoDirectory,`No git repo found in any parent folder. Too dangerous to proceed.`);

    // Load up all the project files into class instances for manipulation
    this.reload();
  }

  // The directory wherein this project lies.
  get absoluteDir(){
    return paths.dirname(this.yypAbsolutePath);
  }

  get gitRepoDirectory(){
    if(typeof this.#gitRepoDirectory == 'undefined'){
      this.#gitRepoDirectory = null;
      // Look for a repo
      let path = this.absoluteDir;
      while(path && path.includes(paths.sep)){
        if(fs.existsSync(paths.join(path,".git"))){
          this.#gitRepoDirectory = path;
        }
        path = paths.dirname(path);
      }
    }
    return this.#gitRepoDirectory;
  }


  /**
   * Recreate in-memory representations of the Gamemaker Project
   * using its files.
   */
  reload(){
    // Load the YYP file, store RAW (ensure field resourceType: "GMProject" exists)
    const yyp = fs.readJsonSync(this.yypAbsolutePath) as YypComponents;
    assert(yyp.resourceType=='GMProject','This is not a GMS2.3+ project.');

    this.#components = {
      ...yyp,
      Options: hydrateArray(yyp.Options,Gms2ProjectOption),
      configs: new Gms2ProjectConfig(yyp.configs),
      Folders: hydrateArray(yyp.Folders,Gms2ProjectFolder),
      RoomOrder: hydrateArray(yyp.RoomOrder,Gms2ProjectRoomOrder),
      TextureGroups: hydrateArray(yyp.TextureGroups, Gms2ProjectTextureGroup),
      AudioGroups: hydrateArray(yyp.AudioGroups,Gms2ProjectAudioGroup),
    };

    // TODO: Load texture groups and ensure sprites are properly assigned

    // TODO: Load audio groups and ensure audio files are properly assigned

    // TODO: Load Included Files

    // TODO: For each resource in the YYP file, create a Resource instance
  }

  // TODO: TO TEST, do deep comparison of the loaded content vs. the dehydrate output

  dehydrate(): YypComponents {
    const fields = Object.keys(this.#components) as (keyof YypComponents)[];
    const asObject: Partial<YypComponents> = {};
    for(const field of fields){
      const component = this.#components[field] as any;
      asObject[field] = component?.dehydrate?.() ?? component;
    }
    return asObject as YypComponents;
  }
}