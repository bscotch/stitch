import type {
  GameMakerCliBuildWorker,
  GameMakerCliOptions,
} from '../types/gameMakerCli.js';

/**
 * GameMaker CLI workers that are for making builds
 * and that are supported by Stitch.
 */
export type StitchSupportedBuilder = Exclude<
  GameMakerCliBuildWorker,
  'amazonfire' | 'html5' | 'operagx' | 'ps4' | 'ps5' | 'tvos' | 'wasm'
>;

export interface GameMakerRuntimeConfig {
  active: string;
  [version: string]: string;
}

export interface GameMakerUserData {
  deviceID?: string;
  /**
   * User email address. The 'name' part is
   * used as the local username.
   */
  login?: `${string}@${string}`;
  userID?: string;
}

export type GameMakerSupportedArchitecture = 'x64' | 'arm' | 'arm64';

export interface GameMakerLogOptions {
  logDir?: string;
  /**
   * If `true`, will not include the timestamp
   * in the logfile names. This is useful when
   * you want to clobber the logs files with the
   * latest logs.
   */
  excludeLogFileTimestamps?: boolean;
}

export interface GameMakerRunOptions extends GameMakerLogOptions {
  /**
   * @default 'windows'
   */
  targetPlatform?: StitchSupportedBuilder;
  config?: string;
  yyc?: boolean;
}

export interface GameMakerBuildOptions extends GameMakerRunOptions {
  /**
   * The name of the compiled artifact.
   */
  outDir?: string;
}

export interface GameMakerExecuteOptions
  extends Omit<Partial<GameMakerCliOptions>, 'project'> {}

/**
 * The subset of Stitch's `Gms2Project`
 * interface that the `GameMakerEngine`
 * class makes use of.
 */
export interface GameMakerEngineProject {
  readonly name: string;
  readonly yypPathAbsolute: string;
  readonly yypDirAbsolute: string;
}

export interface GameMakerExecutionResults {
  /**
   * Whether just building *or* running, we
   * always attempt to compile. If `false`,
   * Igor exited before finishing the compile.
   */
  compileSucceeded: boolean;
  /**
   * If we are only building, the runner's
   * success is `undefined`
   *
   * Otherwise, this value is `true` if
   * the runner exits normally (e.g. via
   * the user closing the window or via
   * the GML function `game_end()`) and
   * `false` otherwise.
   */
  runnerSucceeded?: boolean;
  stdout: string;
  stderr: string;
  compilerLogsPath: string;
  runnerLogsPath?: string;
  compilerLogs: string;
  runnerLogs?: string;
}
