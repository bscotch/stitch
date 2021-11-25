/**
 * Create a "mirror" of a GMS2 project, which has metadata, reports,
 * etc with sourcemaps leading back to the original code.
 *
 * **⚠ This is experimental! **
 */

import { listFilesByExtensionSync } from '@bscotch/utility';
import path from 'path';
import Gms2Project, { Gms2ResourceChangeListener } from '../index.js';
import type { Gms2ResourceSubclass } from './components/Gms2ResourceArray.js';
import { StitchError } from './errors.js';
import type { Gms2ProjectOptions } from './Gms2Project.js';

type Gms2AsTypescriptOptions = Pick<Gms2ProjectOptions, 'projectPath'>;

/*
REFERENCE TRACKING & TRANSPILING

On Init:
  - Create a mirror of the project so we're ready to go.
  - Write a gml.d.ts shim file for all static globals (built-in functions)

The parsing and cross-ref process has to happen in *waves*:

- Convert a resource into "files" (basically their GML)
- Find *all* Macros across all files (they may contain references!)
- Magic-string-replace *all* Macros across all files
- Find all *global* variables across all objects & scripts
*/

type Gms2References = {
  [scope: string]: {
    [name: string]: {
      type: 'function' | 'variable' | 'macro';
      source: {
        resource: Gms2ResourceSubclass;
      };
    };
  };
};

type Gms2Macro = {
  name: string;
  value: string;
  source: {
    resource: Gms2ResourceSubclass;
  };
};

export class Gms2AsTypescript {
  readonly project: Gms2Project;
  private macros: Map<string, Gms2Macro> = new Map();

  /**
   * Whether we've gotten our initial set of listener events
   * from loading the project.
   */
  private loaded = false;

  constructor(options?: Gms2AsTypescriptOptions) {
    const listener = this.on.bind(this);
    // Loading is SYNCHRONOUS
    this.project = new Gms2Project({
      ...options,
      listener,
    });
    this.loaded = true;

    // For now can just iterate through and try to rewrite everything...
    this.copyRawTypeFiles();

    // TODO: TEST-TRANSFORM -- see if magic-stringing will do anything for us *at all*
    // TODO: Convert each Sprite to an instance of a shim class, write to file (same file name as original with .ts extension)
    // TODO: Prepare for magic-stringing with a VERY FEW basics:
    //  - Convert "globalvar" declarations to plain declarations
    //  - Convert #region to //#region etc
    //  - Convert macros to global variables (will need to get much fancier later)
    //  - Convert struct contructors to classes
    // TODO: For Objects we need the *actual code*. The OG code is broken over files, but ideally we can shove them all into one in the magically-changed file.
    // TODO: Convert each script to a .ts file.
  }

  get typesDir() {
    return path.join(this.project.storage.yypDirAbsolute, 'types', 'gml');
  }

  private copyRawTypeFiles() {
    this.project.storage.ensureDir(this.typesDir);
    this.getGmlTypesFilePaths().forEach((filePath) => {
      const targetPath = path.join(this.typesDir, path.basename(filePath));
      console.log({ filePath, targetPath });
      this.project.storage.copyFile(filePath, targetPath);
    });
  }

  /**
   * Event router, which should be attached to a project instance.
   *
   * @type {Gms2ResourceChangeListener}
   */
  on(...args: Parameters<Gms2ResourceChangeListener>) {
    const [change, resource] = args;
    switch (change) {
      case 'create':
        this.onCreated(resource);
        break;
      default:
        throw new StitchError(`Unhandled resource change: ${change}`);
    }
  }

  onCreated(resource: Gms2ResourceSubclass) {
    console.log(`Created ${resource.type}: ${resource.name}`);

    // Store it!

    // Most resources need to have their names loaded into the global scope
    // so that they can be referenced by other resources.
  }

  getGmlTypesFilePaths(): string[] {
    return listFilesByExtensionSync(
      path.join(__dirname, '..', '..', 'gml'),
      'ts',
      true,
    );
  }
}
