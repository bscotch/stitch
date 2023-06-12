import { pathy, Pathy } from '@bscotch/pathy';
import {
  FileDifferenceType,
  StitchProject,
  StitchProjectConfig,
} from '@bscotch/stitch';
import {
  AssetSourcesConfig,
  type AudioAsset,
  type DeletedAsset,
} from '@bscotch/stitch/asset-sources';
import {
  MaxAge,
  memoize,
  memoizeUnresolved,
  sequential,
} from '@bscotch/utility';
import { Yy } from '@bscotch/yy';
import open from 'open';
import { projectsEmitter } from './emitters.js';
import { trpcAssert } from './error.js';
import { GameMakerManager } from './GameMakerManager.js';
import { listImages } from './image.js';
import type { ConfigFileProject, ProjectSummary } from './schemas.js';
import { projectSummarySchema } from './schemas.js';
import { StitchDesktopConfig } from './StitchDesktopConfig.js';

@memoize
export class StitchDesktopProject {
  protected _core?: Promise<StitchProject>;

  protected constructor(
    protected data: ProjectSummary,
    protected projectConfig: StitchProjectConfig,
  ) {}

  get core(): Promise<StitchProject> {
    this._core ||= StitchProject.from({
      projectPath: this.path,
      dangerouslyAllowDirtyWorkingDir: true,
    });
    return this._core;
  }

  get sources() {
    return this.data.sources;
  }

  get id() {
    return this.data.id;
  }

  get path() {
    return this.data.path;
  }

  get dir() {
    return pathy(this.path).up();
  }

  get ideVersion() {
    return this.data.ideVersion;
  }

  async open(
    app: 'game-maker' | 'code' | 'explorer' = 'game-maker',
    config: StitchDesktopConfig,
  ) {
    const folder = (await this.gitRoot())?.absolute || this.path;
    if (app === 'game-maker') {
      const options = await config.load();
      return await GameMakerManager.openProject(this.path, this.ideVersion, {
        programFiles: options.ideInstallRoot,
      });
    } else if (app === 'code') {
      return await open(folder, {
        app: {
          name: [
            'code-insiders',
            'Visual Studio Code - Insiders',
            'code',
            'Visual Studio Code',
          ],
        },
      });
    } else {
      return await open(folder);
    }
  }

  @sequential
  async setAssetSourceImportability(
    sourceId: string,
    fileIds: string[],
    importable: boolean,
  ) {
    const config = AssetSourcesConfig.from(
      this.getAudioSourceConfigPath(sourceId),
    );
    await config.toggleImportables(sourceId, fileIds, importable);
  }

  @sequential
  async importSounds(sourceId: string) {
    const core = await this.core;
    await core.addSounds(this.getAudioSourceConfigPath(sourceId));
    projectsEmitter.emit('projectsChanged');
  }

  @memoize
  async gitRoot(): Promise<Pathy | undefined> {
    const root = (await pathy(this.path).findInParents('.git'))?.up();
    return root;
  }

  @sequential
  async setIdeVersion(toVersion: string) {
    const versions = await GameMakerManager.versions();
    const version = versions.find((v) => v.version === toVersion);
    trpcAssert(version, 'Version not found', 'NOT_FOUND');
    const yyp = await Yy.read(this.path, 'project');
    yyp.MetaData.IDEVersion = version.version;
    await Yy.write(this.path, yyp, 'project');
    // Update the runtime version in the project's stitch config
    // to the paired version if we know it (else undefined)
    await this.setRuntimeVersion(version.runtimeVersion);
  }

  @sequential
  protected async setRuntimeVersion(version: string | undefined) {
    await this.projectConfig.setRuntimeVersion(version);
  }

  @memoizeUnresolved
  async getAudioSourceAssets(sourceId: string) {
    trpcAssert(
      sourceId in this.data.sources.audio,
      'Source not found',
      'NOT_FOUND',
    );
    const configPath = this.data.sources.audio[sourceId];
    const changes = await (
      await this.core
    ).checkSoundSource(configPath, sourceId);
    const diff: { [id: string]: FileDifferenceType } = {};
    for (const change of changes) {
      if (!change.areSame) {
        diff[change.source.id] = change.change!;
      }
    }
    const config = AssetSourcesConfig.from(configPath);
    // // (Don't need to refresh, since that happened when checking against target)
    // const source = await config.refreshAudioSource(sourceId);
    const [source] = await config.findAudioSource(sourceId);
    const grouped = source.grouped();

    // Re-sort grouped to put changed files at the top
    grouped.groups.forEach((group) => {
      group.files.sort((a, b) => {
        // Leave current sort unless one has a change
        return +!!diff[b.id] - +!!diff[a.id];
      });
    });
    grouped.groups.sort((a, b) => {
      // Re-sort by *any* needs review, then *any* changed, then current sort
      return (
        +b.files.some((f) => !f.importable) -
          +a.files.some((f) => !f.importable) ||
        +!!b.files.find((f) => diff[f.id]) - +!!a.files.find((f) => diff[f.id])
      );
    });

    // Add change info
    return {
      ...grouped,
      diff,
    };
  }

  protected sortAssetFiles(
    a: AudioAsset | DeletedAsset,
    b: AudioAsset | DeletedAsset,
  ) {
    // First by *deleted*
    if (a.deleted && !b.deleted) {
      return 1;
    } else if (!a.deleted && b.deleted) {
      return -1;
    }
    // Then by *importable*
    if (a.importable && !b.importable) {
      return 1;
    }
    if (b.importable && !a.importable) {
      return -1;
    }
    if ('updatedAt' in a && 'updatedAt' in b) {
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    }
    return 0;
  }

  getAudioSourceConfig(sourceId: string) {
    return AssetSourcesConfig.from(this.getAudioSourceConfigPath(sourceId));
  }

  getAudioSourceConfigPath(sourceId: string) {
    trpcAssert(
      sourceId in this.data.sources.audio,
      'Source not found',
      'NOT_FOUND',
    );
    return this.data.sources.audio[sourceId];
  }

  toJSON(): ProjectSummary {
    return { ...this.data };
  }

  @MaxAge(600, 300)
  protected static async findDisplayName(
    yypPath: string,
  ): Promise<string | undefined> {
    const projectDir = pathy(yypPath).up();
    const optionsDir = pathy('options', projectDir);
    let name: string | undefined;
    if (!(await optionsDir.exists())) {
      return name;
    }
    await optionsDir.listChildrenRecursively({
      softLimit: 1,
      async filter(path) {
        if (await path.isFile()) {
          if (path.hasExtension('yy')) {
            const yy = (await Yy.read(path.absolute)) as Record<string, any>;
            const nameKey = Object.keys(yy).find(
              (k) =>
                k.match(/^option_[^_]+_display_name$/) &&
                typeof yy[k] &&
                typeof yy[k] === 'string' &&
                !yy[k].match(/gamemaker/i),
            );
            if (nameKey) {
              name = yy[nameKey];
              return true;
            }
          }
          return false;
        }
        return;
      },
    });
    return name;
  }

  @MaxAge(600, 300)
  protected static async listIcons(yypPath: string) {
    const projectDir = pathy(yypPath).up();
    const optionsDir = pathy('options', projectDir);
    if (!(await optionsDir.exists())) {
      return [];
    }
    const icons = (
      await listImages(optionsDir, { maxResults: 36, relative: true })
    )
      .filter((x) => x.width >= 32 && x.height === x.width)
      .map((x) => ({
        ...x,
        path: x.path,
      }));
    icons.sort((a, b) => a.width - b.width);
    return icons;
  }

  static async from(config: Partial<ConfigFileProject> & { path: string }) {
    const projectConfig = StitchProjectConfig.from(config.path);
    const [yy, projectConfigData, icons, name] = await Promise.all([
      Yy.read(config.path, 'project'),
      projectConfig.load(),
      StitchDesktopProject.listIcons(config.path),
      StitchDesktopProject.findDisplayName(config.path),
    ]);

    const data = projectSummarySchema.parse({
      ...config,
      name: name || yy.name,
      ideVersion: yy.MetaData.IDEVersion,
      runtimeVersion: projectConfigData.runtimeVersion,
      icons,
    });
    return new StitchDesktopProject(data, projectConfig);
  }

  static async fromEach(
    configs: string[] | (Partial<ConfigFileProject> & { path: string })[],
  ): Promise<StitchDesktopProject[]> {
    const waits: Promise<StitchDesktopProject>[] = [];
    for (const config of configs) {
      const info = {
        path: typeof config === 'string' ? config : config.path,
        ...(typeof config === 'object' ? config : {}),
      };
      waits.push(StitchDesktopProject.from(info));
    }
    return await Promise.all(waits);
  }
}
