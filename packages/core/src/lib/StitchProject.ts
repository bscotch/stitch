import { pathy, Pathy } from '@bscotch/pathy';
import { explode, oneline, RequiredBy } from '@bscotch/utility';
import { Yyp, yypAudioGroupSchema, yypTextureGroupSchema } from '@bscotch/yy';
import archiver from 'archiver';
import { paramCase } from 'change-case';
import fse from 'fs-extra';
import { basename, join, parse as parsePath } from 'path';
import { Gms2ProjectComponents } from '../types/Gms2ProjectComponents.js';
import { assert } from '../utility/errors.js';
import fs, {
  compareFilesByChecksum,
  FileDifference,
} from '../utility/files.js';
import { debug, info } from '../utility/log.js';
import paths from '../utility/paths.js';
import { Gms2AudioGroup } from './components/Gms2AudioGroup.js';
import { Gms2ComponentArray } from './components/Gms2ComponentArray.js';
import { Gms2Config } from './components/Gms2Config.js';
import { Gms2Folder } from './components/Gms2Folder.js';
import { Gms2IncludedFile } from './components/Gms2IncludedFile.js';
import { Gms2IncludedFileArray } from './components/Gms2IncludedFileArray.js';
import { Gms2Option } from './components/Gms2Option.js';
import { Gms2ResourceArray } from './components/Gms2ResourceArray.js';
import { Gms2RoomOrder } from './components/Gms2RoomOrder.js';
import { Gms2TextureGroup } from './components/Gms2TextureGroup.js';
import { GameMakerEngine } from './GameMakerEngine.js';
import {
  GameMakerBuildOptions,
  GameMakerRunOptions,
} from './GameMakerEngine.types.js';
import { GameMakerIssue } from './GameMakerIssue.js';
import { Gms2FolderArray } from './Gms2FolderArray.js';
import { Linter, LinterOptions, LinterReportFormat } from './Linter.js';
import { GmlTokenSummary } from './parser/GmlTokenSummary.js';
import { addSprites } from './StitchProject.addSprites.js';
import {
  addAudioGroupAssignment,
  addTextureGroupAssignment,
  ensureResourceGroupAssignments,
} from './StitchProject.groups.js';
import { mergeFromGithub, mergeFromUrl } from './StitchProject.merge.js';
import { Gms2Platform, StitchProjectStatic } from './StitchProject.static.js';
import type {
  FindGlobalFunctionReferencesOptions,
  GameMakerProjectCloneOptions,
  SpriteImportOptions,
  StitchProjectComms,
  StitchProjectOptions,
  StitchProjectPlugin,
} from './StitchProject.types.js';
import {
  setProjectVersion,
  versionOnPlatform,
} from './StitchProject.version.js';
import { StitchProjectConfig } from './StitchProjectConfig.js';
import {
  Gms2MergerGitHubOptions,
  Gms2ProjectMerger,
  StitchMergerOptions,
} from './StitchProjectMerger.js';
import { StitchStorage } from './StitchStorage.js';
import {
  AssetSourcesConfig,
  AudioAsset,
  DeletedAsset,
} from './assetSource/assetSource.js';

export * from './StitchProject.static.js';
export * from './StitchProject.types.js';

const inDev = process.env.BSCOTCH_REPO === '@bscotch/tech';

if (inDev) {
  Error.stackTraceLimit = 50;
}

/**
 * Convert a GameMaker Studio 2.3+ project
 * into an internal representation that can
 * be manipulated programmatically.
 */
export class StitchProject extends StitchProjectStatic {
  /**
   * The content of the YYP file, mirroring the data structure
   * in the file but with components replaced by model instances.
   */
  protected components!: Gms2ProjectComponents;
  readonly config: StitchProjectConfig;
  protected plugins: StitchProjectPlugin[] = [];
  readonly storage: StitchStorage;

  /**
   * A representation of an "Issue" for submission
   * to GameMaker. Its methods can be used to create
   * an issue form, fetch log info, and compile a
   * report.
   */
  readonly issue: GameMakerIssue;

  static async load(options?: StitchProjectOptions): Promise<StitchProject> {
    const yypPath = await StitchProject.findYypFile(
      options?.projectPath || process.cwd(),
    );
    const project = new StitchProject({ ...options, projectPath: yypPath });
    await project.reload();
    return project;
  }

  static readonly from = StitchProject.load;

  protected constructor(
    options: RequiredBy<StitchProjectOptions, 'projectPath'>,
  ) {
    super();

    // Normalize options
    debug(`loading project with options`, options);

    this.plugins = options.plugins || [];

    // Load up all the project files into class instances for manipulation
    this.storage = new StitchStorage(
      paths.resolve(options.projectPath),
      options.readOnly as boolean,
      options.dangerouslyAllowDirtyWorkingDir as boolean,
    );
    this.config = StitchProjectConfig.from(this.storage);
    this.issue = new GameMakerIssue(this);
  }

  /**
   * Compile the project using Igor.
   * @alpha
   */
  async build(options?: GameMakerBuildOptions) {
    return await this.engine().build(this, options);
  }

  /**
   * Run the project using Igor.
   * @alpha
   */
  async run(options?: GameMakerRunOptions) {
    return await this.engine().run(this, options);
  }

  /**
   * Change the name of the project stored in its
   * YYP file.
   *
   * (Not the name of the file itself.)
   */
  get name(): string {
    return parsePath(this.storage.yypPathAbsolute).name;
  }
  set name(newProjectName: string) {
    if (this.name === newProjectName) {
      return;
    }
    this.storage.renameYypFile(newProjectName);
  }

  get resourceVersion() {
    return this.components.resourceVersion;
  }

  get io(): StitchProjectComms {
    const io: StitchProjectComms = {
      storage: this.storage,
      plugins: this.plugins,
      project: this,
    };
    return Object.freeze(io);
  }

  get yypPathAbsolute() {
    return this.storage.yypPathAbsolute;
  }

  get yypDirAbsolute() {
    return this.storage.yypDirAbsolute;
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

  get rooms() {
    return this.resources.rooms;
  }

  get roomOrder() {
    return this.components.RoomOrderNodes;
  }

  get configs() {
    return this.components.configs;
  }

  get ideVersion(): string {
    return this.components.MetaData.IDEVersion;
  }

  /**
   * For GameMaker versions starting in 2022,
   * returns `true` if the version indicates
   * that the IDE in use is a beta IDE.
   *
   * For versions before that, always returns `undefined`.
   */
  get ideVersionIsBeta(): boolean | undefined {
    return GameMakerEngine.isBetaVersion(this.ideVersion);
  }

  /**
   * The local path where the GameMaker engine stores
   * runtimes, IDE configs, and other information.
   *
   * Uses the project's IDE Version and the current
   * OS to determine this directory.
   *
   * (Only works on Windows.)
   */
  engine() {
    return new GameMakerEngine({ beta: this.ideVersionIsBeta });
  }

  listScriptGmlFiles() {
    return this.resources.scripts.map((s) => s.codeFilePathAbsolute);
  }

  listObjectGmlFiles() {
    return this.resources.objects.map((o) => o.codeFilePathsAbsolute).flat(1);
  }

  getGlobalFunctions() {
    return this.resources.getGlobalFunctions();
  }

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
    setProjectVersion(this, versionString);
  }

  versionOnPlatform(platform: Gms2Platform) {
    return versionOnPlatform(this, platform);
  }

  /**
   * Bundle the project into a single zip file with the `.yyz` extension.
   */
  async exportYyz(options?: { outputDirectory?: string }) {
    const yyz = archiver('zip');
    const resolver = new Promise((resolve, reject) => {
      yyz.on('finish', resolve);
      yyz.on('error', reject);
    });
    const projectBasename = basename(this.yypPathAbsolute);
    const yyzBasename = projectBasename.replace(/\.yyp$/, '.yyz');
    const outputPath = join(
      options?.outputDirectory || this.yypDirAbsolute,
      yyzBasename,
    );
    const output = fse.createWriteStream(outputPath);
    yyz.pipe(output);
    // Whitelist files and folders to zip up
    const folders = [
      'animcurves',
      'datafiles',
      'extensions',
      'fonts',
      'notes',
      'objects',
      'options',
      'paths',
      'rooms',
      'scripts',
      'sequences',
      'shaders',
      'sounds',
      'sprites',
      'tilesets',
      'timelines',
    ];
    const yyDir = new Pathy(this.yypDirAbsolute);
    for (const folder of folders) {
      if (await yyDir.join(folder).exists()) {
        yyz.directory(yyDir.join(folder).absolute, folder);
      }
    }
    yyz.file(this.yypPathAbsolute, { name: projectBasename });
    await yyz.finalize();
    return await resolver.then(() => ({
      filePath: outputPath,
    }));
  }

  async mergeFromUrl(
    url: string,
    options?: StitchMergerOptions,
    headers?: { [header: string]: any },
  ) {
    return await mergeFromUrl.bind(this)(url, options, headers);
  }

  async mergeFromGithub(options: Gms2MergerGitHubOptions) {
    return await mergeFromGithub.bind(this)(options);
  }

  /**
   * Import modules from one GMS2 project into this one.
   * @param fromProject A directory containing a single .yyp file somwhere,
   * or the path directly to a .yyp file.
   */
  async merge(fromProjectPath: string, options?: StitchMergerOptions) {
    const fromProject = await StitchProject.load({
      projectPath: fromProjectPath,
      readOnly: true,
      dangerouslyAllowDirtyWorkingDir: true,
    });
    await new Gms2ProjectMerger(fromProject, this, options).merge();
    return this;
  }

  /**
   * Get all references to global functions.
   *
   * @alpha
   */
  findGlobalFunctionReferences(options?: FindGlobalFunctionReferencesOptions) {
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
      yypTextureGroupSchema.parse({
        name: textureGroupName,
      }),
      'name',
      textureGroupName,
    ) && this.save(); // So only save if changed
    return this;
  }

  /** Add a texture group assignment if it doesn't already exist. */
  addTextureGroupAssignment(folder: string, textureGroupName: string) {
    return addTextureGroupAssignment(this, folder, textureGroupName);
  }

  /** Ensure an audio group exists in the project */
  addAudioGroup(audioGroupName: string) {
    this.components.AudioGroups.addIfNew(
      yypAudioGroupSchema.parse({
        name: audioGroupName,
      }),
      'name',
      audioGroupName,
    ) && this.save(); // So only save if changed
    return this;
  }

  /** Add a texture group assignment if it doesn't already exist. */
  addAudioGroupAssignment(folder: string, audioGroupName: string) {
    return addAudioGroupAssignment(this, folder, audioGroupName);
  }

  async addRoom(name: string, options?: { first?: boolean }) {
    assert(name.match(/^[a-zA-Z0-9_]+$/), `Invalid room name: ${name}`);
    const room = await this.resources.addRoom(name, this.io);
    if (options?.first) {
      this.components.RoomOrderNodes.removeByField('name', name);
      this.components.RoomOrderNodes.addNew(
        {
          roomId: room.id,
        },
        { prepend: true },
      );
    }
    this.save();
    return room;
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

  /** Does not save the project. */
  private async addSoundByFile(source: string) {
    const fileExt = paths.extname(source).slice(1);
    assert(
      StitchProject.supportedSoundFileExtensions.includes(fileExt),
      oneline`
      Cannot import sound file with extension: ${fileExt}.
      Only supports: ${StitchProject.supportedSoundFileExtensions.join(',')}
      `,
    );
    await this.resources.addSound(source, this.io);
    return this;
  }

  /**
   * Diff an audio source against the project's current audio resources.
   */
  async checkSoundSource(sourceConfigPath: string | Pathy, sourceId?: string) {
    const stitchSrc = AssetSourcesConfig.from(sourceConfigPath);
    const audioSources = (await stitchSrc.listAudioSources()).filter(
      (s) => !sourceId || s.id === sourceId,
    );
    const soundsRoot = pathy(this.yypDirAbsolute).join('sounds');
    const waits: Promise<
      FileDifference & { source: AudioAsset | DeletedAsset }
    >[] = [];
    for (let audioSource of audioSources) {
      audioSource = await stitchSrc.refreshAudioSource(audioSource.id);
      for (const file of audioSource.files) {
        // Create what should be the path to corresponding sound resource
        const { base, name } = paths.parse(file.path);
        const soundPath = soundsRoot.join(name, base);
        waits.push(
          compareFilesByChecksum(
            {
              path: soundPath,
            },
            {
              path: audioSource.absoluteFilePath(file),
              checksum: 'checksum' in file ? file.checksum : undefined,
            },
          ).then((result) => ({
            areSame: result.areSame,
            change: result.change,
            source: file,
          })),
        );
      }
    }
    return await Promise.all(waits);
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
   *
   * If the file is a `stitch.src.json` file, its importable audio source(s)
   * will be used.
   */
  async addSounds(
    source: string,
    options?: {
      /**
       * Optionally provide a target sourceId if using a Stitch Asset Source
       * (otherwise uses all audio sources)
       */
      sourceId?: string;
      /**
       * Optionally limit allowed extensions when discovering sound files
       */
      extensions?: string[];
    },
  ) {
    let targetFiles: string[] = [];
    const sourcePath = pathy(source);
    if (sourcePath.basename === AssetSourcesConfig.basename) {
      const changes = await this.checkSoundSource(
        sourcePath,
        options?.sourceId,
      );
      const stitchSrc = AssetSourcesConfig.from(sourcePath);
      for (const change of changes) {
        if (change.source.deleted || !change.source.importable) {
          continue;
        }
        if (
          !change.areSame &&
          (change.change === 'added' || change.change === 'modified')
        ) {
          targetFiles.push(stitchSrc.dir.join(change.source.path).absolute);
        }
      }
    } else {
      const extensions = options?.extensions?.length
        ? options.extensions
        : StitchProject.supportedSoundFileExtensions;
      for (const extension of extensions) {
        assert(
          StitchProject.supportedSoundFileExtensions.includes(extension),
          oneline`
      Cannot batch import sound file with extension: ${extension}.
      Only supports: ${StitchProject.supportedSoundFileExtensions.join(',')}
      `,
        );
      }
      if (fs.statSync(source).isFile()) {
        targetFiles.push(source);
      } else {
        targetFiles = fs.listFilesByExtensionSync(source, extensions, true);
      }
    }
    const waits: Promise<any>[] = [];
    for (const targetFile of targetFiles) {
      waits.push(this.addSoundByFile(targetFile));
    }
    await Promise.all(waits);
    return targetFiles.length ? this.save() : this;
  }

  /**
   * Add or update a script resource. Unless you're trying to make
   * global variables, your code should be wrapped in a function!
   */
  async addScript(name: string, code: string) {
    await this.resources.addScript(name, code, this.io);
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
  async addSprites(sourceFolder: string, options?: SpriteImportOptions) {
    return await addSprites(this, sourceFolder, options);
  }

  addObject(name: string) {
    const object = this.resources.addObject(name, this.io);
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
   * {@see https://docs2.yoyogames.com/source/_build/3_scripting/4_gml_reference/sprites/sprite_add.html}
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
    info(`included file upserted`, { path });
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
    this.storage.writeYySync(this.yypPathAbsolute, this.toJSON(), 'project');
    return this;
  }

  ensureResourceGroupAssignments() {
    return ensureResourceGroupAssignments(this);
  }

  /**
   * Recreate in-memory representations of the GameMaker Project
   * using its files.
   */
  protected async reload() {
    this.io.plugins.forEach((plugin) => plugin.beforeProjectLoaded?.(this));

    // Load the YYP file, store RAW (ensure field resourceType: "GMProject" exists)
    const yyp = await StitchProject.parseYypFile(this.storage.yypPathAbsolute);

    // TODO: Figure out how to safely manage different typings due
    // TODO: to changes in the YYP (and potentially YY) files with
    // TODO: different IDE versions.
    // @ts-ignore
    this.components = {
      ...yyp,
      Options: new Gms2ComponentArray(yyp.Options, Gms2Option),
      configs: new Gms2Config(yyp.configs),
      Folders: new Gms2FolderArray(yyp.Folders),
      RoomOrderNodes: new Gms2ComponentArray(yyp.RoomOrderNodes, Gms2RoomOrder),
      TextureGroups: new Gms2ComponentArray(
        yyp.TextureGroups,
        Gms2TextureGroup,
      ),
      AudioGroups: new Gms2ComponentArray(yyp.AudioGroups, Gms2AudioGroup),
      IncludedFiles: new Gms2IncludedFileArray(yyp.IncludedFiles, this.storage),
      resources: new Gms2ResourceArray(this, yyp.resources),
    };

    await this.ensureResourceGroupAssignments();
    this.addFolder('NEW'); // Imported assets should go into a NEW folder.

    // DEBORK
    // TODO: Ensure that parent groups (folders) for all subgroups exist as separate entities.

    this.io.plugins.forEach((plugin) => plugin.afterProjectLoaded?.(this));
  }

  /**
   * A deep copy of the project's YYP content with everything as plain primitives (no custom class instances).
   * Perfect for writing to JSON.
   */
  toJSON(): Yyp {
    const fields = Object.keys(this.components) as (keyof Yyp)[];
    const asObject: Partial<Yyp> = {};
    for (const field of fields) {
      const component = this.components[field] as any;
      asObject[field] = component?.toJSON?.() ?? component;
    }
    return asObject as Yyp;
  }

  static async cloneProject(options: GameMakerProjectCloneOptions) {
    // Ensure that the template project actually
    // exists, and get access to its details.
    const template = await StitchProject.load({
      projectPath: options.templatePath,
      readOnly: true,
      dangerouslyAllowDirtyWorkingDir: true,
    });
    const templateFolder = new Pathy(template.yypDirAbsolute);
    const where = (
      options.where ? new Pathy(options.where) : templateFolder.up()
    ).join(paramCase(options.name || template.name));
    await where.ensureDirectory();
    await where.isEmptyDirectory({ assert: true });

    // Copy over all of the project's files
    await templateFolder.copy(where, {
      filter: (p) =>
        !p.match(
          /\b(node_modules(?![\\/]+@bscotch[\\/]+stitch\b)|.git|tmp|logs?)\b/,
        ),
    });

    const project = await StitchProject.load({
      projectPath: where.absolute,
      dangerouslyAllowDirtyWorkingDir: true,
    });

    if (options.name && options.name !== template.name) {
      project.name = options.name;
    }

    return project;
  }
}
