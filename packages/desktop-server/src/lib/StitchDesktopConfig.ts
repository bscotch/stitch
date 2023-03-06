import { Pathy } from '@bscotch/pathy';
import { StitchProject } from '@bscotch/stitch';
import { AssetSourcesConfig } from '@bscotch/stitch/asset-sources';
import { memoize, MemoizedClass, sequential } from '@bscotch/utility';
import { homedir } from 'os';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { projectsEmitter } from './emitters.js';
import { trpcAssert } from './error.js';
import { type ConfigFile, configFileSchema } from './schemas.js';
import { StitchDesktopProject } from './StitchDesktopProject.js';

export interface StitchDesktopConfig extends MemoizedClass {}

@memoize
export class StitchDesktopConfig {
  protected emitter = projectsEmitter;

  readonly path = new Pathy([homedir(), '.stitch']).join<ConfigFile>(
    'desktop.json',
  );

  emitProjectsChanged() {
    this.clearMemoized();
    this.emitter.emit('projectsChanged');
  }

  @sequential
  async addAudioSource(projectId: string, directory: string) {
    const config = await this.load();
    const project = config.projects.find((p) => p.id === projectId);
    trpcAssert(project, 'Project not found', 'NOT_FOUND');
    const sourceConfig = AssetSourcesConfig.from(directory);
    let [source] = await sourceConfig.listAudioSources();
    if (!source) {
      source = await sourceConfig.addAudioSource({});
    }
    project.sources.audio[source.id] = sourceConfig.path.absolute;
    await this.save(config);
    this.emitProjectsChanged();
    return source;
  }

  @sequential
  async removeAudioSource(projectId: string, sourceId: string) {
    const config = await this.load();
    const project = config.projects.find((p) => p.id === projectId);
    trpcAssert(project, 'Project not found', 'NOT_FOUND');
    const sourceConfigPath = project.sources.audio[sourceId];
    trpcAssert(sourceConfigPath, 'Source not found', 'NOT_FOUND');
    Reflect.deleteProperty(project.sources.audio, sourceId);
    const sourceConfig = AssetSourcesConfig.from(sourceConfigPath);
    try {
      await sourceConfig.removeSource(sourceId);
    } catch {}
    await this.save(config);
    this.emitProjectsChanged();
  }

  onProjectsChanged(listener: (projects: StitchDesktopProject[]) => void) {
    const l = async () => {
      listener(await this.listProjects());
    };
    this.emitter.on('projectsChanged', l);
    return () => this.emitter.off('projectsChanged', l);
  }

  async getSetting<T extends keyof ConfigFile>(key: T): Promise<ConfigFile[T]> {
    const config = await this.load();
    return config[key];
  }

  async setSetting<T extends keyof ConfigFile>(
    key: T,
    value: ConfigFile[T],
  ): Promise<ConfigFile[T]> {
    const config = await this.load();
    config[key] = value;
    await this.save(config);
    return value;
  }

  async findProjectById(
    projectId: string,
  ): Promise<StitchDesktopProject | undefined> {
    const projects = await this.listProjects();
    return projects.find((p) => p.id === projectId);
  }

  async listProjects(): Promise<StitchDesktopProject[]> {
    const config = await this.load();
    // Make sure project info is up to date
    const projects = await StitchDesktopProject.fromEach(config.projects);
    return projects;
  }

  @sequential
  async removeProject(projectId: string) {
    const config = await this.load();
    config.projects = config.projects.filter((p) => p.id !== projectId);
    await this.save(config);
    this.emitProjectsChanged();
  }

  @sequential
  async addProjects(searchStart: string): Promise<StitchDesktopProject[]> {
    // Find all of the Yyp files!
    const yypFiles = await StitchProject.listYypFilesRecursively(searchStart);
    // Convert each Yyp file into whatever Stitch Desktop needs.
    // For now, just return the name and path.
    const projects = await StitchDesktopProject.fromEach(yypFiles);
    // Only add new projects
    const config = await this.load();
    const newProjects: StitchDesktopProject[] = [];
    for (const project of projects) {
      if (!config.projects.find((p) => Pathy.equals(p.path, project.path))) {
        config.projects.push({
          id: project.id,
          path: project.path,
          sources: { audio: {} },
        });
        newProjects.push(project);
      }
    }
    await this.save(config);
    this.emitProjectsChanged();
    return newProjects;
  }

  async ensureExists() {
    const config = await this.load();
    await this.save(config);
  }

  /**
   * Load the config from disk, returning a deep copy.
   */
  async load(): Promise<ConfigFile> {
    const config = configFileSchema.parse(
      await this.path.read({ fallback: {} }),
    );
    return config;
  }

  @sequential
  protected async save(config: ConfigFile): Promise<void> {
    const schemaPath = this.path.changeExtension('json', 'schema.json');
    await schemaPath.write(zodToJsonSchema(configFileSchema));
    await this.path.write(
      configFileSchema.parse({
        $schema: `./${schemaPath.basename}`,
        ...config,
      }),
    );
  }
}
