import { Pathy } from '@bscotch/pathy';
import { ok } from 'assert';
import { homedir } from 'os';
import { GameMakerEngine, GameMakerEngineProject } from './GameMakerEngine.js';
import {
  GameMakerLogOptions,
  StitchSupportedBuilder,
} from './GameMakerEngine.types.js';

export class GameMakerEngineStatic {
  static artifactExtension(platform: StitchSupportedBuilder) {
    const extensions: {
      [P in StitchSupportedBuilder]: string;
    } = {
      android: 'aab',
      ios: 'iap',
      linux: 'zip',
      mac: 'zip',
      switch: 'nsp',
      windows: 'zip',
      winuwp: 'appxbundle',
      xboxone: 'xboxone-pkg',
      xboxseriesxs: 'xboxseriesxs-pkg',
    };
    const extension = extensions[platform];
    ok(extension, `Unsupported platform, no extension defined: ${platform}`);
    return extension;
  }

  static directory(beta?: boolean) {
    const dir = `C:\\ProgramData\\${GameMakerEngineStatic.engineName(beta)}`;
    return new Pathy(dir, dir);
  }

  static runtimeDirectory(version: string) {
    const isBeta = GameMakerEngineStatic.isBetaVersion(version);
    return GameMakerEngineStatic.directory(isBeta).join(
      'Cache',
      'runtimes',
      `runtime-${version}`,
    );
  }

  static get localConfigDirectory() {
    return new Pathy(`${homedir()}/.stitch`);
  }

  static get ideVersionsFolder() {
    return GameMakerEngineStatic.localConfigDirectory.join('engine/ide');
  }

  static get runtimeVersionsFolder() {
    return GameMakerEngineStatic.localConfigDirectory.join('engine/runtime');
  }

  static async installed() {
    const engines: { beta?: GameMakerEngine; release?: GameMakerEngine } = {};
    for (const beta of [false, true]) {
      const ideDirectory = GameMakerEngineStatic.directory(beta);
      if (await ideDirectory.exists()) {
        engines[beta ? 'beta' : 'release'] = new GameMakerEngine({ beta });
      }
    }
    return engines;
  }

  static engineName(beta = false) {
    let name = `GameMakerStudio2`;
    if (beta) {
      name += '-Beta';
    }
    return name;
  }

  /**
   * Given a version string, from the GameMaker IDE or
   * runner, returns `true` if the version string looks
   * like a beta version, `false` if it does not, and
   * `undefined` if it cannot be determined.
   *
   * (The undefined case occurs for older versions.)
   */
  static isBetaVersion(version: string) {
    const stablePatterns = /^(2|20\d\d)\.\d{1,2}\.\d+\.\d+$/;
    const betaPatterns = /^(23\.\d|20\d\d\.\d{3,})\.\d+\.\d+$/;
    return version.match(stablePatterns)
      ? false
      : version.match(betaPatterns)
      ? true
      : undefined;
  }

  static async logDir(
    project: GameMakerEngineProject,
    options?: GameMakerLogOptions,
  ) {
    const logDir = new Pathy(
      options?.logDir || new Pathy(project.yypDirAbsolute).join('logs'),
    );
    await logDir.ensureDirectory();
    return logDir;
  }
}
