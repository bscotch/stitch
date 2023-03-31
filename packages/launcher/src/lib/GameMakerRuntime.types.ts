import { GameMakerLogOptions } from './GameMakerLauncher.types.js';
import {
  GameMakerCliBuildWorker,
  GameMakerCliOptions,
} from './GameMakerRuntime.cliTypes.js';

/**
 * GameMaker CLI workers that are for making builds
 * and that are supported by Stitch.
 */
export type StitchSupportedBuilder = Exclude<
  GameMakerCliBuildWorker,
  'amazonfire' | 'html5' | 'operagx' | 'ps4' | 'ps5' | 'tvos' | 'wasm'
>;

export type GameMakerSupportedArchitecture = 'x64' | 'arm' | 'arm64';

export interface GameMakerRunOptions extends GameMakerLogOptions {
  /**
   * Full path to a GameMaker yyp file.
   */
  project: string;
  /**
   * @default 'windows'
   */
  targetPlatform?: StitchSupportedBuilder;
  config?: string;
  yyc?: boolean;
  noCache?: boolean;
  quiet?: boolean;
}

export interface GameMakerBuildOptions extends GameMakerRunOptions {
  /**
   * The name of the compiled artifact.
   */
  outDir?: string;
}

export interface GameMakerExecuteOptions extends Partial<GameMakerCliOptions> {}

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
