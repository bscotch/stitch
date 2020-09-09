import {Gms2PipelineError} from "./errors";


export interface Gms2ProjectConfig {
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

  constructor(options?:Gms2ProjectConfig){
    // Find the YYP file

    // Set path information (project root, location of YYP, relative paths)
  }

  /**
   * Recreate in-memory representations of the Gamemaker Project
   * using its files.
   */
  reload(){
    // Load the YYP file, store RAW

    // For each resource in the YYP file, create a Resource instance

    // Load texture groups and ensure sprites are properly assigned

    // Load audio groups and ensure audio files are properly assigned
  }
}