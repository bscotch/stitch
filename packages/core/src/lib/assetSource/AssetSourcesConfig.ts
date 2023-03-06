import { pathy, Pathy } from '@bscotch/pathy';
import { assert, toJson } from '@bscotch/utility';
import { logger } from './assetSource.lib.js';
import { AssetSourceFileAudio } from './AssetSourceFile.js';
import {
  type AudioSourceConfig,
  audioSourceConfigSchema,
  configFileSchema,
  type SourceConfig,
  type ConfigFile,
  GroupedSourceConfig,
} from './assetSource.types.js';

export class AssetSourceConfig<T extends SourceConfig = SourceConfig> {
  constructor(readonly dir: Pathy, protected config: T) {}

  get id(): string {
    return this.config.id;
  }

  get type(): T['type'] {
    return this.config.type;
  }

  get files(): T['files'] {
    return [...this.config.files];
  }
  set files(files: T['files']) {
    this.config.files = files;
  }

  absoluteFilePath(file: T['files'][number]): Pathy {
    return this.dir.join(file.path);
  }

  grouped(): GroupedSourceConfig<T> {
    const grouped: GroupedSourceConfig<T> = {
      ...this.config,
      groups: [],
    };
    if (!this.config.groupBy?.length) {
      grouped.groups.push({ name: '', files: this.config.files });
      return grouped;
    }
    const groupMap = new Map<string, T['files']>();
    const groupPatterns = this.config.groupBy.map((p) => new RegExp(p));
    for (const file of this.files) {
      let group = '';
      for (const pattern of groupPatterns) {
        group = file.path.match(pattern)?.groups?.group ?? '';
        if (group) {
          break;
        }
      }
      const groupedFiles: T['files'] = groupMap.get(group) ?? [];
      groupedFiles.push(file);
      groupMap.set(group, groupedFiles);
    }
    grouped.groups = [...groupMap.entries()]
      .map(([group, files]) => ({
        name: group,
        files: files.sort(this.compareFiles),
      }))
      .sort((a, b) => {
        return this.compareFiles(a.files[0], b.files[0]);
      });
    return grouped;
  }

  toJSON(): T {
    return { ...this.config };
  }

  compareFiles(a: T['files'][number], b: T['files'][number]) {
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
}

export class AssetSourcesConfig {
  readonly path: Pathy<ConfigFile>;

  constructor(path: string | Pathy<any>) {
    let configPath = Pathy.asInstance(path);
    configPath =
      configPath.basename === AssetSourcesConfig.basename
        ? configPath
        : configPath.join(AssetSourcesConfig.basename);
    this.path = Pathy.asInstance<ConfigFile>(configPath);
  }

  get dir() {
    return this.path.up();
  }

  async listAudioSources(): Promise<AssetSourceConfig<AudioSourceConfig>[]> {
    return (await this.listSources({
      filter: (s) => s.type === 'audio',
    })) as any;
  }

  async listSources(options?: {
    filter: (sources: AssetSourceConfig) => any;
  }): Promise<AssetSourceConfig[]> {
    let sources = (await this.load()).sources.map(
      (s) => new AssetSourceConfig(this.dir, s),
    );
    if (options?.filter) {
      sources = sources.filter(options.filter);
    }
    return sources;
  }

  async findAudioSource(
    id: string,
    config?: ConfigFile,
  ): Promise<[AssetSourceConfig<AudioSourceConfig>, number]> {
    const source = await this.findSource(id, config);
    assert(source[0].type === 'audio', `Source ${id} is not an audio source`);
    return source;
  }

  async findSource(
    id: string,
    config?: ConfigFile,
  ): Promise<[source: AssetSourceConfig, idx: number]> {
    config ||= await this.load();
    const matchingSourceIdx = config.sources.findIndex((s) => s.id === id);
    const matchingSource = config.sources[matchingSourceIdx];
    assert(matchingSource, `No audio source found with ID ${id}`);
    return [new AssetSourceConfig(this.dir, matchingSource), matchingSourceIdx];
  }

  async addAudioSource(
    info?: Partial<AudioSourceConfig>,
  ): Promise<AssetSourceConfig<AudioSourceConfig>> {
    const config = await this.load();
    if (info?.id && config.sources.some((s) => s.id === info.id)) {
      throw new Error(`Source with id "${info.id}" already exists.`);
    }
    // For now, since we only have one set of audio source rules (i.e. "find everything")
    // we should just return any already-existing source.
    let audioSourceConfig = config.sources.find((s) => s.type === 'audio');
    if (!audioSourceConfig) {
      audioSourceConfig = audioSourceConfigSchema.default({}).parse(info);
      config.sources.push(audioSourceConfig);
      await this.write(config);
    }
    return await this.refreshAudioSource(audioSourceConfig.id);
  }

  async removeSource(id: string) {
    const config = await this.load();
    const [, sourceIdx] = await this.findSource(id, config);
    config.sources.splice(sourceIdx, 1);
    if (config.sources.length === 0) {
      await this.path.delete();
    } else {
      await this.write(config);
    }
  }

  async updateAudioSource(
    id: string,
    info: Partial<Omit<AudioSourceConfig, 'id' | 'files'>>,
  ): Promise<AudioSourceConfig> {
    assert(
      !('id' in info) || info.id === id,
      'Cannot change the id of an audio source',
    );
    assert(
      !('files' in info),
      'Cannot directly change the files of an audio source',
    );
    const config = await this.load();
    const [matchingSource, matchingSourceIdx] = await this.findSource(
      id,
      config,
    );
    config.sources[matchingSourceIdx] = audioSourceConfigSchema.parse({
      ...matchingSource,
      ...info,
    });
    await this.write(config);
    await this.refreshAudioSource(id);
    return matchingSource as any;
  }

  /**
   * Update the config file to reflect the current state
   * of all described files.
   */
  async refreshAudioSource(
    id: string,
  ): Promise<AssetSourceConfig<AudioSourceConfig>> {
    const config = await this.load();
    const [source, sourceIdx] = await this.findSource(id, config);
    assert(source.type === 'audio', `Source ${id} is not an audio source`);
    const existingPaths: Set<string> = new Set();
    const [knownAudioFiles, audioFilePaths] = await Promise.all([
      Promise.all(
        source.files.map((f) => {
          const file = AssetSourceFileAudio.from(pathy(f.path, this.dir), f);
          existingPaths.add(file.path.toString());
          return file;
        }),
      ),
      this.dir.listChildrenRecursively({
        includeExtension: ['mp3', 'wav', 'ogg', 'wma'],
        transform: (p) => {
          return new AssetSourceFileAudio(pathy(p, this.dir));
        },
      }),
    ]);

    // Identify new files
    for (const audioFilePath of audioFilePaths) {
      if (!existingPaths.has(audioFilePath.path.toString())) {
        knownAudioFiles.push(audioFilePath);
        logger.info(`Found new audio file: ${audioFilePath.path.relative}`);
      }
    }
    knownAudioFiles.sort((a, b) => Pathy.compare(a.path, b.path));
    const files = await Promise.all(knownAudioFiles.map((f) => f.refresh()));
    source.files = toJson(files);
    config.sources[sourceIdx] = source.toJSON();
    await this.write(config);
    return source;
  }

  async toggleImportables(
    sourceId: string,
    fileIds: string[],
    importable: boolean,
  ) {
    const config = await this.load();
    const [source] = await this.findSource(sourceId, config);
    const fileIdsSet = new Set(fileIds);
    for (const file of source.files) {
      if (fileIdsSet.size === 0) {
        break;
      }
      if (fileIdsSet.has(file.id)) {
        file.importable = importable;
        fileIdsSet.delete(file.id);
      }
    }
    await this.write(config);
  }

  async toggleImportable(
    sourceId: string,
    fileId: string,
    importable: boolean,
  ) {
    await this.toggleImportables(sourceId, [fileId], importable);
  }

  async load(): Promise<ConfigFile> {
    return await this.path.read({
      schema: configFileSchema,
      fallback: {},
    });
  }

  protected async write(config: ConfigFile): Promise<void> {
    await this.path.write(config, {
      schema: configFileSchema,
    });
  }

  static readonly basename = 'stitch.src.json';

  static from(path: string | Pathy): AssetSourcesConfig {
    return new AssetSourcesConfig(path);
  }
}
