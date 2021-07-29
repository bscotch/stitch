import { StitchError, assert } from './errors';
import fs from './files';
import { explode, md5, oneline } from '@bscotch/utility';
import paths from './paths';
import { YypComponents, YypComponentsLegacy } from '../types/Yyp';
import { Gms2ProjectComponents } from '../types/Gms2ProjectComponents';
import { Gms2Option } from './components/Gms2Option';
import { Gms2Config } from './components/Gms2Config';
import { Gms2Folder } from './components/Gms2Folder';
import { Gms2RoomOrder } from './components/Gms2RoomOrder';
import { Gms2TextureGroup } from './components/Gms2TextureGroup';
import { Gms2AudioGroup } from './components/Gms2AudioGroup';
import { Gms2ComponentArray } from './components/Gms2ComponentArray';
import { Gms2ResourceArray } from './components/Gms2ResourceArray';
import { Gms2Storage } from './Gms2Storage';
import { Gms2ProjectConfig } from './Gms2ProjectConfig';
import { Gms2Sprite } from './components/resources/Gms2Sprite';
import { Gms2Sound } from './components/resources/Gms2Sound';
import { Gms2FolderArray } from './Gms2FolderArray';
import { Gms2MergerOptions, Gms2ProjectMerger } from './Gms2ProjectMerger';
import { Gms2IncludedFile } from './components/Gms2IncludedFile';
import { Gms2IncludedFileArray } from './components/Gms2IncludedFileArray';
import { Spritely, SpritelyBatch } from '@bscotch/spritely';
import { snakeCase, camelCase, pascalCase } from 'change-case';
import { debug, error, info } from './log';
import { get, unzipRemote } from './http';
import { getGithubAccessToken } from './env';
import { GmlTokenSummary } from './parser/GmlTokenSummary';
import { Linter, LinterOptions, LinterReportFormat } from './Linter';

type YypComponentsVersion = YypComponents | YypComponentsLegacy;

type ProjectPlatformVersion =
  | `option_${Gms2TargetPlatform}_version`
  | 'option_xbone_version';

export interface SpriteImportOptions {
  /** Optionally prefix sprite names on import */
  prefix?: string;
  /** Optionall postfix sprite names on import */
  postfix?: string;
  /** Enforce casing standards. Defaults to 'snake'. */
  case?: 'snake' | 'camel' | 'pascal';
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

export interface Gms2ProjectOptions {
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
    try {
      // Normalize options
      debug(
        `loading project with options: ${JSON.stringify(options, null, 2)}`,
      );
      options = {
        projectPath:
          typeof options == 'string'
            ? options
            : options?.projectPath || process.cwd(),
        readOnly: (typeof options != 'string' && options?.readOnly) || false,
        dangerouslyAllowDirtyWorkingDir:
          (typeof options != 'string' &&
            options?.dangerouslyAllowDirtyWorkingDir) ||
          false,
      };
      debug(`parsed options: ${JSON.stringify(options, null, 2)}`);

      // Find the yyp filepath
      let yypPath = options.projectPath as string;
      if (!yypPath.endsWith('.yyp')) {
        debug(`project path is not a yyp file, need to search for one`);
        const yypParentPath = yypPath;
        const yypPaths = fs
          .listFilesByExtensionSync(yypParentPath, 'yyp', true)
          .filter((yyp) => {
            try {
              Gms2Project.parseYypFile(yyp);
              return true;
            } catch {
              return false;
            }
          });
        debug(`found yyp files:\n\t${yypPaths.join('\n\t')}`);
        if (yypPaths.length == 0) {
          throw new StitchError(
            `Couldn't find a Stitch-compatible .yyp file in "${yypParentPath}"`,
          );
        }
        if (yypPaths.length > 1) {
          throw new StitchError(oneline`
            Found multiple Stitch-compatible .yyp files in "${yypParentPath}".
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
        options.dangerouslyAllowDirtyWorkingDir as boolean,
      );
      this.config = new Gms2ProjectConfig(this.storage);
      this.reload();
    } catch (err) {
      // If one of OUR errors, just show a log. Else throw.
      if (err instanceof StitchError) {
        error(err.message);
      }
      throw err;
    }
  }

  get yypAbsolutePath() {
    return this.storage.yypAbsolutePath;
  }

  get folders() {
    return this.components.Folders;
  }

  get resources() {
    return this.components.resources;
  }

  get textureGroups() {
    return this.components.TextureGroups;
  }

  get audioGroups() {
    return this.components.AudioGroups;
  }

  get includedFiles() {
    return this.components.IncludedFiles;
  }

  get configs() {
    return this.components.configs;
  }

  getGlobalFunctions() {
    return this.resources.getGlobalFunctions();
  }

  private switchSearchRegex = new RegExp(
    `(?<pre><DisplayVersion>)(?<versionString>.*)(?<post></DisplayVersion>)`,
  );

  private setSwitchVersion(normalizedVersionString: string, fileName: string) {
    const oldContent = this.storage.readBlob(fileName).toString();
    const newContent = oldContent.replace(
      this.switchSearchRegex,
      `$1${normalizedVersionString}$3`,
    );
    this.storage.writeBlob(fileName, newContent);
  }

  private getSwitchVersion(fileName: string) {
    const content = this.storage.readBlob(fileName).toString();
    const newContent = content.match(this.switchSearchRegex)?.groups;
    if (newContent) {
      return newContent['versionString'];
    } else {
      throw new StitchError(
        `Cannot parse the Switch *.nmeta file to obtain the version`,
      );
    }
  }

  //Xbox key name follows a different pattern, hence the special treatment
  private xboxVersionKey = 'option_xbone_version' as const;

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
  set version(versionString: string) {
    const parts = versionString.match(
      /^(?<major>\d+)\.(?<minor>\d+)\.(?<patch>\d+)((\.(?<revision>\d+))|(-rc.(?<candidate>\d+)))?$/,
    );
    if (!parts) {
      throw new StitchError(
        `Version string ${versionString} is not a valid format.`,
      );
    }
    const { major, minor, patch, revision, candidate } = parts.groups as {
      [part: string]: string;
    };
    const normalizedVersionString = [
      major,
      minor,
      patch,
      candidate || revision || '0',
    ].join('.');
    const optionsDir = paths.join(this.storage.yypDirAbsolute, 'options');
    const optionsFiles = this.storage.listFiles(optionsDir, true, [
      'yy',
      'nmeta',
    ]);
    for (const file of optionsFiles) {
      // Load it, change the version, and save
      if (paths.extname(file) == '.yy') {
        const content = this.storage.readJson(file);
        const platform = paths.basename(
          paths.dirname(file),
        ) as Gms2TargetPlatform;
        if (Gms2Project.platforms.includes(platform)) {
          let versionKey =
            `option_${platform}_version` as ProjectPlatformVersion;
          if (platform == 'xboxone') {
            versionKey = this.xboxVersionKey;
          }
          content[versionKey] = normalizedVersionString;
          this.storage.writeJson(file, content);
        }
      }
      // Switch *.nmeta file needs special treatment
      else if (paths.extname(file) == '.nmeta') {
        this.setSwitchVersion(normalizedVersionString, file);
      } else {
        throw new StitchError(
          `Found unsupported file format in the options dir: ${file}`,
        );
      }
    }
  }

  versionOnPlatform(platform: Gms2TargetPlatform) {
    const optionsDir = paths.join(this.storage.yypDirAbsolute, 'options');
    if (platform != 'switch') {
      const optionsFile = paths.join(
        optionsDir,
        platform,
        `options_${platform}.yy`,
      );
      let versionKey = `option_${platform}_version` as ProjectPlatformVersion;
      if (platform == 'xboxone') {
        versionKey = this.xboxVersionKey;
      }
      return this.storage.readJson(optionsFile)[versionKey] as string;
    } else {
      const optionsFile = this.storage.listFiles(optionsDir, true, [
        'nmeta',
      ])?.[0];
      if (optionsFile) {
        return this.getSwitchVersion(optionsFile);
      } else {
        throw new StitchError(
          `The project does not contain a valid *.nmeta file with version info.`,
        );
      }
    }
  }

  async mergeFromUrl(
    url: string,
    options?: Gms2MergerOptions,
    headers?: { [header: string]: any },
  ) {
    const unzipPath = paths.join(
      paths.dirname(this.yypAbsolutePath),
      `tmp-${md5(url)}`,
    );
    const sourcePath = await unzipRemote(url, unzipPath, headers);
    this.merge(sourcePath, options);
    fs.emptyDirSync(unzipPath);
    fs.removeSync(unzipPath);
    return this;
  }

  async mergeFromGithub(
    repoOwner: string,
    repoName: string,
    options?: {
      revision?: string;
      revisionType?: '@' | '?';
      tagPattern?: string;
    } & Gms2MergerOptions,
  ) {
    // Figure out the revision based on options.
    let revision = options?.revision || 'HEAD';
    const token = getGithubAccessToken();
    const headers = token ? { authorization: `Bearer ${token}` } : {};
    const apiBase = `https://api.github.com/repos/${repoOwner}/${repoName}`;
    if (options?.revisionType == '?') {
      // Then need to query the GitHub API.
      const { tagPattern } = options;
      const tags = (await get(`${apiBase}/tags`, headers)).data as {
        name: string;
      }[];
      const latestMatchingTag = tagPattern
        ? tags.find((tag) => tag.name.match(new RegExp(tagPattern, 'i')))
        : tags[0];
      assert(latestMatchingTag, `No GitHub tag matches pattern ${tagPattern}`);
      revision = latestMatchingTag.name;
    }
    const url = `https://github.com/${repoOwner}/${repoName}/archive/${revision}.zip`;
    await this.mergeFromUrl(url, options, headers);
    return this;
  }

  /**
   * Import modules from one GMS2 project into this one.
   * @param fromProject A directory containing a single .yyp file somwhere,
   * or the path directly to a .yyp file.
   */
  merge(fromProjectPath: string, options?: Gms2MergerOptions) {
    const fromProject = new Gms2Project({
      projectPath: fromProjectPath,
      readOnly: true,
      dangerouslyAllowDirtyWorkingDir: true,
    });
    new Gms2ProjectMerger(fromProject, this, options).merge();
    return this;
  }

  /**
   * Get all references to global functions.
   */
  findGlobalFunctionReferences(options?: {
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
  }) {
    const onlyFunctions = options?.functions
      ? typeof options.functions == 'string'
        ? explode(options.functions)
        : options.functions
      : null;
    const functions = this.getGlobalFunctions().filter((func) => {
      if (onlyFunctions) {
        return onlyFunctions.includes(func.name);
      } else if (options?.allowNamePattern) {
        return new RegExp(options.allowNamePattern).test(func.name);
      } else if (options?.excludeNamePattern) {
        return !new RegExp(options.excludeNamePattern).test(func.name);
      }
      return true;
    });
    assert(
      functions.length,
      `No function names provided or found in the project.`,
    );
    const summaries: GmlTokenSummary[] = [];
    for (const func of functions) {
      const summary = new GmlTokenSummary(func, this, {
        versionSuffix: options?.versionSuffix,
      });
      summaries.push(summary);
    }
    return summaries;
  }

  /** Lint this project, resulting in a report of potential issues. */
  lint(options?: LinterOptions & { format?: LinterReportFormat }) {
    return new Linter(this, options);
  }

  /** Ensure that a texture group exists in the project. */
  addTextureGroup(textureGroupName: string) {
    this.components.TextureGroups.addIfNew(
      {
        ...Gms2TextureGroup.defaultDataValues,
        name: textureGroupName,
      },
      'name',
      textureGroupName,
    ) && this.save(); // So only save if changed
    return this;
  }

  /** Add a texture group assignment if it doesn't already exist. */
  addTextureGroupAssignment(folder: string, textureGroupName: string) {
    this.config.addTextureGroupAssignment(folder, textureGroupName);
    this.setTextureGroupsUsingConfig();
    return this;
  }

  /**
   * Ensure that the texture groups used in the config all exist, and
   * that sprites are properly assigned to them. (This must generally be re-run
   * on configuration upate, since cannot handle inheritance with singleton updates.)
   */
  private setTextureGroupsUsingConfig() {
    for (const textureGroupName of this.config
      .textureGroupsWithAssignedFolders) {
      this.addTextureGroup(textureGroupName);
    }
    // Ensure sprites are assigned to correct config texture groups.
    // This can be done by iterating backwards over the assignments,
    // since they get sorted by specificity (lowest first) and we only
    // want the most specific ones (those that match LAST unless reverse-sorted).
    const folders = this.config.foldersWithAssignedTextureGroups.reverse();
    const alreadyAssigned: Set<Gms2Sprite> = new Set();
    for (const folder of folders) {
      this.components.resources
        .filterByClassAndFolder(Gms2Sprite, folder)
        .forEach((sprite) => {
          if (alreadyAssigned.has(sprite)) {
            // Then should already have been assigned with the highest specificity possible.
            return;
          }
          sprite.textureGroup = this.config.textureGroupAssignments[folder];
          alreadyAssigned.add(sprite);
        });
    }
    return this;
  }

  /** Ensure an audio group exists in the project */
  addAudioGroup(audioGroupName: string) {
    this.components.AudioGroups.addIfNew(
      {
        ...Gms2AudioGroup.defaultDataValues,
        name: audioGroupName,
      },
      'name',
      audioGroupName,
    ) && this.save(); // So only save if changed
    return this;
  }

  /** Add a texture group assignment if it doesn't already exist. */
  addAudioGroupAssignment(folder: string, audioGroupName: string) {
    this.config.addAudioGroupAssignment(folder, audioGroupName);
    this.setAudioGroupsUsingConfig();
    return this;
  }

  /**
   * Ensure that the Sound assets have their Audio Groups correctly
   * assigned based on the config file. (This must generally be re-run
   * on configuration upate, since cannot handle inheritance with singleton updates.)
   */
  private setAudioGroupsUsingConfig() {
    for (const audioGroupName of this.config.audioGroupsWithAssignedFolders) {
      this.addAudioGroup(audioGroupName);
    }
    // Ensure sounds are assigned to correct config audio groups
    // This can be done by iterating backwards over the assignments,
    // since they get sorted by specificity (lowest first) and we only
    // want the most specific ones (those that match LAST unless reverse-sorted).
    const folders = this.config.foldersWithAssignedAudioGroups.reverse();
    const alreadyAssigned: Set<Gms2Sound> = new Set();
    for (const folder of folders) {
      this.components.resources
        .filterByClassAndFolder(Gms2Sound, folder)
        .forEach((sound) => {
          if (alreadyAssigned.has(sound)) {
            return;
          }
          sound.audioGroup = this.config.audioGroupAssignments[folder];
          alreadyAssigned.add(sound);
        });
    }
    return this;
  }

  /**
   * Ensure that a folder path exists, so that assets can be assigned to it.
   */
  addFolder(path: string, tags?: string[]) {
    // Clean up messy seperators
    path = path
      .replace(/[/\\]+/, '/')
      .replace(/^\//, '')
      .replace(/\/$/, '');
    // Get all subpaths
    const heirarchy = paths.heirarchy(path);
    for (const subPath of heirarchy) {
      this.folders.addIfNew(
        {
          ...Gms2Folder.defaultDataValues,
          name: Gms2Folder.nameFromPath(subPath),
          folderPath: Gms2Folder.folderPathFromPath(subPath),
          tags: tags || [],
        },
        'path',
        subPath,
      );
    }
    this.save();
    return this;
  }

  static get supportedSoundFileExtensions() {
    return ['mp3', 'ogg', 'wav', 'wma'];
  }

  /** Does not save the project. */
  private addSoundByFile(source: string) {
    const fileExt = paths.extname(source).slice(1);
    assert(
      Gms2Project.supportedSoundFileExtensions.includes(fileExt),
      oneline`
      Cannot import sound file with extension: ${fileExt}.
      Only supports: ${Gms2Project.supportedSoundFileExtensions.join(',')}
      `,
    );
    this.resources.addSound(source, this.storage);
    return this;
  }

  /**
   * Add or update audio files from a file or a directory.
   * The name is taken from
   * the source. If there already exists a sound asset
   * with this name, its file will be replaced. Otherwise
   * the asset will be created and placed into folder "/NEW".
   * Support the following extensions:
   * 1. mp3
   * 2. ogg
   * 3. wav
   * 4. wma
   * @param {string[]} [extensions] Only allow defined extensions.
   * If not defined, will allow all supported extensions.
   */
  addSounds(source: string, extensions?: string[]) {
    if (!extensions || extensions.length == 0) {
      extensions = Gms2Project.supportedSoundFileExtensions;
    }
    for (const extension of extensions) {
      assert(
        Gms2Project.supportedSoundFileExtensions.includes(extension),
        oneline`
      Cannot batch import sound file with extension: ${extension}.
      Only supports: ${Gms2Project.supportedSoundFileExtensions.join(',')}
      `,
      );
    }
    let targetFiles: string[] = [];
    if (fs.statSync(source).isFile()) {
      targetFiles.push(source);
    } else {
      targetFiles = fs.listFilesByExtensionSync(source, extensions, true);
    }
    for (const targetFile of targetFiles) {
      this.addSoundByFile(targetFile);
    }
    return targetFiles.length ? this.save() : this;
  }

  /**
   * Add or update a script resource. Unless you're trying to make
   * global variables, your code should be wrapped in a function!
   */
  addScript(name: string, code: string) {
    this.resources.addScript(name, code, this.storage);
    return this.save();
  }

  /**
   * Add or update a sprite resource, given a folder (sprite)
   * containing subimages (frames). Will use the folder name
   * as the sprite name. Completely replaces the images for
   * the target sprite, and frames are put in alphabetical order
   * by source name.
   */
  private addSprite(sourceFolder: string, nameOverride?: string) {
    this.resources.addSprite(sourceFolder, this.storage, nameOverride);
    return this.save();
  }

  /**
   * Add or update a sprite resource using a Spine export. Pass
   * in the path to the JSON file -- the appropriate .png and .atlas
   * files must also exist in the same directory with the same
   * name.The Spine version must be compatible with GameMaker Studio.
   */
  private addSpineSprite(spriteJsonPath: string, nameOverride?: string) {
    this.resources.addSpineSprite(spriteJsonPath, this.storage, nameOverride);
    this.save();
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
  addSprites(sourceFolder: string, options?: SpriteImportOptions) {
    const spriteBatch = new SpritelyBatch(sourceFolder);
    const sprites: Spritely[] = [];
    const spritesThatAreSpine: Spritely[] = []; // Clunky, but works
    for (const sprite of spriteBatch.sprites) {
      // Check against the exclusion pattern
      if (options?.exclude) {
        const excludeRegex = new RegExp(options?.exclude);
        if (sprite.name.match(excludeRegex)) {
          continue;
        }
      }
      // Check for a pattern indicating that this sprite is
      // from Spine
      const isSpine = this.storage.exists(
        paths.changeExtension(sprite.paths[0], 'atlas'),
      );
      if (isSpine) {
        assert(
          sprite.paths.length == 1,
          oneline`
          Found atlas file for sprite ${sprite.name},
          implying it is a Spine export, but the
          folder has more than one PNG file.`,
        );
        spritesThatAreSpine.push(sprite);
      }
      sprites.push(sprite);
    }
    assert(sprites.length, `No sprites found in ${sourceFolder}`);
    for (const sprite of sprites) {
      let name = options?.flatten
        ? paths.relative(sourceFolder, sprite.path)
        : paths.subfolderName(sprite.path);
      name = name
        .replace(/[.\\/]/g, ' ')
        .replace(/\s+/, ' ')
        .trim();
      const casing = options?.case || 'snake';
      const casedName =
        (casing == 'snake' && snakeCase(name)) ||
        (casing == 'camel' && camelCase(name)) ||
        (casing == 'pascal' && pascalCase(name)) ||
        '';
      assert(casedName, `could not convert ${name} to ${casing} case`);
      const fullName = `${options?.prefix || ''}${casedName}${
        options?.postfix || ''
      }`;
      if (spritesThatAreSpine.includes(sprite)) {
        this.addSpineSprite(
          paths.changeExtension(sprite.paths[0], 'json'),
          fullName,
        );
      } else {
        this.addSprite(sprite.path, fullName);
      }
    }
    return this;
  }

  addObject(name: string) {
    const object = this.resources.addObject(name, this.storage);
    this.save();
    return object;
  }

  deleteResourceByName(name: string) {
    this.resources.deleteByName(name);
    return this.save();
  }

  deleteIncludedFileByName(baseName: string) {
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
  addIncludedFiles(
    path: string,
    options?: {
      content?: any;
      subdirectory?: string;
      allowedExtensions?: string[];
    },
  ) {
    const file = Gms2IncludedFile.import(
      this,
      path,
      options?.content,
      options?.subdirectory,
      options?.allowedExtensions,
    );
    info(`upserted file "${path}"`);
    return file;
  }

  addConfig(name: string) {
    if (!this.components.configs.findChild(name)) {
      this.components.configs.addChild(name);
      this.save();
    }
    return this;
  }

  /** Write *any* changes to disk. (Does nothing if readonly is true.) */
  save() {
    this.storage.writeJson(this.yypAbsolutePath, this);
    return this;
  }

  ensureResourceGroupAssignments() {
    return this.setTextureGroupsUsingConfig().setAudioGroupsUsingConfig();
  }

  /**
   * Recreate in-memory representations of the GameMaker Project
   * using its files.
   */
  private reload() {
    // Load the YYP file, store RAW (ensure field resourceType: "GMProject" exists)
    const yyp = Gms2Project.parseYypFile(this.storage.yypAbsolutePath);

    fs.readJsonSync(this.storage.yypAbsolutePath) as YypComponentsVersion;
    assert(yyp.resourceType == 'GMProject', 'This is not a GMS2.3+ project.');

    // The most recent versions of GMS2 use a RoomOrderNodes field
    // with a different data structure than the older RoomOrder field.
    // Since we're currently not doing anything with that field, we
    // can just allow either.
    const roomOrderField = 'RoomOrder' in yyp ? 'RoomOrder' : 'RoomOrderNodes';
    const roomOrderList =
      'RoomOrder' in yyp
        ? new Gms2ComponentArray(yyp.RoomOrder, Gms2RoomOrder)
        : new Gms2ComponentArray(yyp.RoomOrderNodes, Gms2RoomOrder);

    // TODO: Figure out how to safely manage different typings due
    // TODO: to changes in the YYP (and potentially YY) files with
    // TODO: different IDE versions.
    // @ts-ignore
    this.components = {
      ...yyp,
      Options: new Gms2ComponentArray(yyp.Options, Gms2Option),
      configs: new Gms2Config(yyp.configs),
      Folders: new Gms2FolderArray(yyp.Folders),
      [roomOrderField]: roomOrderList,
      TextureGroups: new Gms2ComponentArray(
        yyp.TextureGroups,
        Gms2TextureGroup,
      ),
      AudioGroups: new Gms2ComponentArray(yyp.AudioGroups, Gms2AudioGroup),
      IncludedFiles: new Gms2IncludedFileArray(yyp.IncludedFiles, this.storage),
      resources: new Gms2ResourceArray(yyp.resources, this.storage),
    };

    this.ensureResourceGroupAssignments().addFolder('NEW'); // Imported assets should go into a NEW folder.

    // DEBORK
    // TODO: Ensure that parent groups (folders) for all subgroups exist as separate entities.
  }

  /**
   * A deep copy of the project's YYP content with everything as plain primitives (no custom class instances).
   * Perfect for writing to JSON.
   */
  toJSON(): YypComponentsVersion {
    const fields = Object.keys(
      this.components,
    ) as (keyof YypComponentsVersion)[];
    const asObject: Partial<YypComponentsVersion> = {};
    for (const field of fields) {
      const component = this.components[field] as any;
      asObject[field] = component?.toJSON?.() ?? component;
    }
    return asObject as YypComponentsVersion;
  }

  static get platforms() {
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
      'xboxone',
    ] as const;
  }

  /**
   * Check a YYP file for version comaptibility with Stitch.
   */
  private static parseYypFile(yypFilepath: string) {
    const yyp = fs.readJsonSync(yypFilepath) as YypComponentsVersion;
    assert(yyp.resourceType == 'GMProject', 'This is not a GMS2.3+ project.');
    return yyp;
  }
}

export type Gms2TargetPlatform = typeof Gms2Project.platforms[number];
