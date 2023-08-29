import type { Gms2ResourceSubclass } from './components/Gms2ResourceArray.js';
import type { SpriteSource } from './StitchProject.addSprites.js';
import type { StitchProject } from './StitchProject.js';
import type { StitchStorage } from './StitchStorage.js';

export interface GameMakerProjectCloneOptions {
  /**
   * If provided, the cloned project will have its
   * name changed to this.
   */
  name?: string;
  /**
   * The root directory in which to clone this project.
   * The project will be added *as a folder* within this
   * location.
   *
   * Defaults to the folder containing the template project.
   */
  where?: string;
  /**
   * Path to an existing GameMaker project to use
   * as a template. The new project
   * will essentially be a clone of the old one.
   */
  templatePath: string;
}

export interface StitchProjectPlugin {
  afterResourceCreated?: (resource: Gms2ResourceSubclass) => void;
  beforeProjectLoaded?: (project: StitchProject) => void;
  afterProjectLoaded?: (project: StitchProject) => void;
  beforeSpritesAdded?: (
    project: StitchProject,
    info: { requestId: string; spriteSources: SpriteSource[] },
  ) => void;
  afterSpritesAdded?: (
    project: StitchProject,
    info: { requestId: string; spriteSources: SpriteSource[] },
  ) => void;
  beforeSpriteAdded?: (
    project: StitchProject,
    info: {
      requestId: string;
      spriteSource: SpriteSource & { exists: boolean };
    },
  ) => void;
}

/**
 * Projects are represented by a complex collection of
 * class instances of various types. To enable them to
 * communicate with each other, the parent Project instance,
 * the file I/O system, and (someday) local networks, all
 * instances need to have access to the same, centralized
 * communications mechanisms and information.
 */
export interface StitchProjectComms {
  /**
   * Centralized file I/O
   */
  storage: StitchStorage;
  /**
   * Plugins, with optional event callbacks
   */
  plugins: StitchProjectPlugin[];
  /**
   * The project instance, so that downstream
   * resources can get information from it.
   */
  project: StitchProject;
}

export interface SpriteImportOptions {
  /** Optionally prefix sprite names on import */
  prefix?: string;
  /** Optionall postfix sprite names on import */
  postfix?: string;
  /** Enforce casing standards. Defaults to 'keep'. */
  case?: 'keep' | 'snake' | 'camel' | 'pascal';
  /**
   * Convert path separator characters into some other
   * value. If `case` is not 'keep', this is ignored.
   * Defaults to '_'.
   */
  pathSeparator?: string;
  /**
   * Normally only the immediate parent folder containing
   * images is used as the sprite name. Optionally "flatten"
   * the parent folders up to the root (the root being
   * where the import started) to create the name. For example,
   * for `root/my/sprite/image.png` the flattened name would
   * be `my_sprite` (if using snake case).
   */
  flatten?: boolean;
  /**
   * Any sprite names matching the pattern will *not* be imported.
   */
  exclude?: RegExp | string;
}

export interface StitchProjectOptions {
  /**
   * Path to a directory in which a .yyp file can be
   * found, or directly to a .yyp file. If not set,
   * will recurse through deeper folders and attempt
   * to find a *single* .yyp file.
   */
  projectPath?: string;
  /**
   * Prevent any files from being written by
   * locking the project instance. Cannot be unlocked.
   */
  readOnly?: boolean;
  /**
   * By default Gms2Project instances will throw an
   * error before doing anything when they are in an
   * unclean Git repo. This is to reduce the likelihood
   * of unrecoverable changes. You can turn off this
   * requirement, but you sure better know what you're
   * doing!
   */
  dangerouslyAllowDirtyWorkingDir?: boolean;
  /**
   * @alpha
   *
   * **WARNING**: This is an experimental feature.
   * It currently only supports calling on each resource
   * during project load (only the "created" event).
   *
   * Register a listener for when a resource is "changed"
   * (on initial load, the "created" event is always fired).
   *
   * This is experimental, intended to be used as a hook
   * for performing actions (logging, transpiling,
   * language server events, etc).
   *
   * @note
   * A future update to add a watcher option directly to
   * the Gms2Project class so that it can live-track project
   * changes will pair nicely with this!
   */
  plugins?: StitchProjectPlugin[];
}

export interface FindGlobalFunctionReferencesOptions {
  /**
   * List of functions (either as CSV string or string array)
   * to check. Takes precedence over allow/excludePattern.
   */
  functions?: string | string[];
  /**
   * Allowlist functions matching some pattern.
   * Will be converted to regex using
   * JavaScript new RegExp(excludePattern) without flags.
   */
  allowNamePattern?: string;
  /**
   * Blocklist functions matching some pattern.
   * Will be converted to regex using
   * JavaScript new RegExp(excludePattern) without flags.
   */
  excludeNamePattern?: string;
  /**
   * A regex pattern (as a string) that, if provided,
   * will be used to identify references to patterns
   * matching function names with this suffix attached.
   *
   * @example
   * const versionSuffix = '(_v\d+)?';
   */
  versionSuffix?: string;
}
