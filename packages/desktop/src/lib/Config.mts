import { Pathy } from '@bscotch/pathy';
import { constants } from './importBridge.mjs';

interface Config {
  /**
   * The last opened project, identified by
   * its YYP path.
   */
  lastOpenedProjectPath?: string;
  /**
   * The local projects opened in StitchDesktop,
   * as the paths to their YYP files.
   */
  projectsPaths?: string[];
}

export class GlobalConfig {
  static readonly path = new Pathy<Config>(constants.stitchConfigDir).join(
    'desktop.json',
  );

  async listProjects(): Promise<string[]> {
    const config = await this.load();
    return config.projectsPaths || [];
  }

  async updateLastOpened(lastOpenedYypPath: string): Promise<void> {
    const config = await this.load();
    config.lastOpenedProjectPath = new Pathy(lastOpenedYypPath).absolute;
    await this.save(config);
  }

  async addProject(yypPath: string) {
    const config = await this.load();
    config.projectsPaths = [
      ...(config.projectsPaths || []),
      GlobalConfig.normalizePath(yypPath),
    ];
    await this.save(config);
  }

  async removeProject(yypPath: string) {
    yypPath = GlobalConfig.normalizePath(yypPath);
    const config = await this.load();
    config.projectsPaths = (config.projectsPaths || []).filter(
      (p) => p !== yypPath,
    );
    await this.save(config);
  }

  protected async load(): Promise<Config> {
    if (!(await GlobalConfig.path.exists())) {
      return {};
    }
    return GlobalConfig.path.read();
  }

  protected async save(config: Config): Promise<void> {
    await GlobalConfig.path.write(config);
  }

  protected static normalizePath(path: string): string {
    return new Pathy(path).absolute;
  }
}
