import { Pathy } from '@bscotch/pathy';
import { ok } from 'assert';
import os from 'os';
import {
  GameMakerCliCommand,
  GameMakerCliWorker,
} from '../types/gameMakerCli.js';
import { runBuildCommand, runGameMakerCommand } from './GameMakerEngine.run.js';
import { GameMakerEngineStatic } from './GameMakerEngine.static.js';
import {
  GameMakerBuildOptions,
  GameMakerEngineProject,
  GameMakerExecuteOptions,
  GameMakerLogOptions,
  GameMakerRunOptions,
  GameMakerRuntimeConfig,
  GameMakerSupportedArchitecture,
  GameMakerUserData,
} from './GameMakerEngine.types.js';
import { GameMakerUser } from './GameMakerUser.js';

export * from './GameMakerEngine.types.js';

/**
 * Discover and convert the currently installed GameMaker Studio
 * into an internal representation that can
 * be manipulated programmatically.
 */
export class GameMakerEngine extends GameMakerEngineStatic {
  readonly dir: Pathy;
  readonly isBeta: boolean;

  constructor(options?: { beta?: boolean }) {
    super();
    ok(
      os.platform() === 'win32',
      `The GameMakerEngine class only supports Windows.`,
    );
    this.isBeta = options?.beta || false;
    this.dir = GameMakerEngine.directory(options?.beta);
    this.dir.existsSync({ assert: true });
  }

  get name() {
    return GameMakerEngine.engineName(this.isBeta);
  }

  get runtimesConfigPath() {
    return this.dir.join('runtime.json');
  }

  get uiLogPath() {
    return this.dir.join('ui.log');
  }

  get appDataPath(): Pathy {
    ok(process.env.APPDATA, 'APPDATA is not defined');
    return new Pathy(process.env.APPDATA!, process.env.APPDATA);
  }

  get usersDirectory(): Pathy {
    return this.appDataPath.join(this.name);
  }

  get usersConfigFilePath(): Pathy {
    return this.usersDirectory.join('um.json');
  }

  get currentOs() {
    const platform = os.platform();
    const platformNiceName =
      platform === 'win32'
        ? 'windows'
        : platform === 'darwin'
        ? 'osx'
        : platform === 'linux'
        ? 'linux'
        : undefined;
    ok(platformNiceName, `Unsupported platform: ${platform}`);
    return platformNiceName;
  }

  get currentArchitecture(): GameMakerSupportedArchitecture {
    const arch = os.arch();
    ok(
      ['x64', 'arm', 'arm64'].includes(arch),
      `Unsupported architecture: ${arch}`,
    );
    return arch as GameMakerSupportedArchitecture;
  }

  async run(project: GameMakerEngineProject, options?: GameMakerRunOptions) {
    return await this.runBuildCommand(project, options);
  }

  async build(
    project: GameMakerEngineProject,
    options?: GameMakerBuildOptions,
  ) {
    return await this.runBuildCommand(project, {
      ...options,
      compile: true,
    });
  }

  protected async runBuildCommand(
    project: GameMakerEngineProject,
    options?: GameMakerBuildOptions & { compile?: boolean },
  ) {
    return await runBuildCommand.bind(this)(project, options);
  }

  /**
   * The local directory for the currently active user.
   */
  async userDirectory(): Promise<Pathy> {
    const user = await this.user();
    const folderName = `${user.userName}_${user.userId}`;
    const dir = this.usersDirectory.join(folderName);
    return dir;
  }

  /**
   * The currently active user.
   */
  async user() {
    return new GameMakerUser(await this.userConfig());
  }

  /**
   * The contents of the config file for the active
   * user.
   */
  async userConfig() {
    return await this.usersConfigFilePath.read<GameMakerUserData>();
  }

  async runtimesConfig(): Promise<GameMakerRuntimeConfig> {
    return await this.runtimesConfigPath.read<GameMakerRuntimeConfig>();
  }

  /**
   * The path to the current runtime's folder,
   * which contains config information and the
   * runtime executable, plus Igor etc.
   */
  async runtimeDirectory() {
    const config = await this.runtimesConfig();
    const version = config.active;
    return new Pathy(GameMakerEngine.runtimeDirectory(version));
  }

  /**
   * Path to the most recently used rumtime CLI executable.
   */
  async cliPath(): Promise<Pathy> {
    return (await this.runtimeDirectory()).join(
      'bin',
      'igor',
      this.currentOs,
      this.currentArchitecture,
      `Igor${this.currentOs === 'windows' ? '.exe' : ''}`,
    );
  }

  /**
   * The most recently used runtime version.
   */
  async runtimeVersion(): Promise<string> {
    const config = await this.runtimesConfig();
    return config.active;
  }

  protected async execute<W extends GameMakerCliWorker>(
    project: GameMakerEngineProject,
    worker: W,
    command: GameMakerCliCommand<W>,
    executionOptions: GameMakerExecuteOptions,
    otherOptions?: GameMakerLogOptions,
  ) {
    return await runGameMakerCommand(
      this,
      project,
      worker,
      command,
      executionOptions,
      otherOptions,
    );
  }
}
