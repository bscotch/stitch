import {
  Channel,
  gameMakerReleaseWithNotesSchema,
  releasesUrl,
  runtimeFeedUrls,
} from '@bscotch/gamemaker-releases';
import { Pathy, pathy } from '@bscotch/pathy';
import { MaxAge } from '@bscotch/utility/browser';
import { z } from 'zod';
import {
  GameMakerChannel,
  GameMakerInstalledVersion,
  GameMakerKnownPath,
  gameMakerUserDataSchema,
} from './GameMakerLauncher.types.js';
import { GameMakerUser } from './GameMakerUser.js';
import {
  RuntimeFeedsFile,
  cleanVersionString,
  downloadIfCacheExpired,
  listGameMakerDataDirs,
  listInstalledIdes,
  listRuntimeFeedsConfigPaths,
  stitchConfigDir,
} from './utility.js';

export class GameMakerComponent {
  constructor(protected info: GameMakerInstalledVersion) {}

  get version() {
    return this.info.version;
  }

  get channel() {
    return this.info.channel;
  }

  get executablePath() {
    return this.info.executablePath;
  }

  get directory() {
    return this.info.directory;
  }

  get publishedAt() {
    return this.info.publishedAt;
  }

  get usersDirectory() {
    return pathy(GameMakerComponent.userDirectories[this.channel || 'beta']);
  }

  async activeUser() {
    const userInfoFilePath = this.usersDirectory.join('um.json');
    return new GameMakerUser(
      await userInfoFilePath.read({
        schema: gameMakerUserDataSchema,
        fallback: {},
      }),
    );
  }

  async activeUserDirectory() {
    const userInfo = await this.activeUser();
    return this.usersDirectory.join(userInfo.directoryBasename);
  }

  /**
   * List paths to important files and directories.
   */
  @MaxAge(60, 30)
  static async listWellKnownPaths(options?: { programFiles?: string }) {
    const known: GameMakerKnownPath[] = [];
    const [dataDirs, ideExes] = await Promise.all([
      listGameMakerDataDirs(),
      listInstalledIdes(options?.programFiles),
    ]);

    for (const dir of dataDirs) {
      known.push({
        id: 'gameMakerDataDir',
        path: dir.absolute,
        name: 'IDE: Data',
        description: 'The directory in which all GameMaker data is stored.',
      });
      known.push({
        id: 'runtimeFeedsConfigFile',
        path: dir.join('runtime_feeds.json').absolute,
        name: 'Runtime: Feeds',
        description:
          'The list of Runtime Feed URLs used by the IDE to find and display allowed runtimes.',
      });
      known.push({
        id: 'activeRuntimeConfigFile',
        path: dir.join('runtime.json').absolute,
        name: 'Runtime: Active',
        description: 'The active runtime to be used by the IDE.',
      });
      known.push({
        id: 'defaultMacrosFile',
        path: dir.join('default_macros.json').absolute,
        name: 'IDE: Defaults',
        description: `IDE configuration defaults, including URLs for IDE feeds.`,
      });
      known.push({
        id: 'runtimesCacheDir',
        path: dir.join('Cache/runtimes').absolute,
        name: 'Runtime: Downloads',
        description: `The local cache for downloaded GameMaker Runtimes.`,
      });
      known.push({
        id: 'uiLogFile',
        path: dir.join('ui.log').absolute,
        name: 'IDE: UI Logs',
        description: `Logs created by the GameMaker IDE during its most recent run.`,
      });
    }

    for (const exe of ideExes) {
      known.push({
        id: 'gameMakerIdeDir',
        path: exe.up().absolute,
        name: 'IDE: Installation Directory',
        description: 'Where the GameMaker installer installs the IDE.',
      });
      known.push({
        id: 'gameMakerIdeExe',
        path: exe.absolute,
        name: 'IDE: Executable',
        description: 'The GameMaker IDE executable.',
      });
      known.push({
        id: 'initialDefaultMacrosFile',
        path: exe.up().join('defaults/default_macros.json').absolute,
        name: 'IDE: Initial Defaults',
        description: `IDE configuration defaults, which can be overridden in the program data's default_macros.json file.`,
      });
    }

    const userDirs = GameMakerComponent.userDirectories;
    for (const [, dir] of Object.entries(userDirs)) {
      const path = pathy(dir);
      if (!(await path.exists())) {
        continue;
      }
      known.push({
        id: 'gameMakerUserDir',
        path: path.absolute,
        name: `User: Directory`,
        description: `Where GameMaker stores login and related data.`,
      });
      known.push({
        id: 'activeUserFile',
        path: path.join('um.json').absolute,
        name: 'User: Active',
        description: `Information about the most recently active user.`,
      });
    }

    return known;
  }

  public static get releasesCachePath() {
    return GameMakerComponent.cacheDir
      .join(`releases-summary.json`)
      .withValidator(z.array(gameMakerReleaseWithNotesSchema));
  }

  public static async listReleases(options?: {
    /** Max age of the cached releases list */
    maxAgeSeconds?: number;
  }) {
    await downloadIfCacheExpired(
      releasesUrl,
      GameMakerComponent.releasesCachePath,
      options?.maxAgeSeconds || 1800,
    );
    return await GameMakerComponent.releasesCachePath.read();
  }

  public static async findRelease(searchOptions: {
    ideVersion?: string;
    runtimeVersion?: string;
    maxAgeSeconds?: number;
  }) {
    const releases = await GameMakerComponent.listReleases({
      maxAgeSeconds: searchOptions.maxAgeSeconds,
    });
    const release = releases.find((release) => {
      if (searchOptions.ideVersion) {
        return (
          release.ide.version === cleanVersionString(searchOptions.ideVersion)
        );
      } else if (searchOptions.runtimeVersion) {
        return (
          release.runtime.version ===
          cleanVersionString(searchOptions.runtimeVersion)
        );
      }
      return false;
    });
    return release;
  }

  public static get userDirectories(): {
    [Channel in GameMakerChannel]: string;
  } {
    const prefix = `${process.env.APPDATA}/GameMakerStudio2`;
    return {
      lts: `${prefix}-LTS`,
      stable: prefix,
      beta: `${prefix}-Beta`,
      unstable: `${prefix}-Beta`,
    };
  }

  public static get cacheDir(): Pathy {
    return stitchConfigDir.join('launcher');
  }

  /**
   * Ensure that all official runtime feeds are available to the user
   * by adding missing feeds to the appropriate GameMaker configs.
   */
  static async ensureOfficialRuntimeFeeds(
    channels: Channel[] = ['lts', 'stable', 'beta'],
  ) {
    const feedConfigs: RuntimeFeedsFile = [];
    const runtimeUrls = runtimeFeedUrls();
    for (const channel of channels) {
      feedConfigs.push({
        Key: channel,
        Value: runtimeUrls[channel],
      });
    }
    for (const configFile of await listRuntimeFeedsConfigPaths()) {
      const existingConfig = await configFile.read();
      maybeNew: for (const feed of feedConfigs) {
        for (const existing of existingConfig) {
          if (existing.Value === feed.Value) {
            continue maybeNew;
          }
        }
        // Then this is a new feed
        existingConfig.push(feed);
      }
      await configFile.write(existingConfig);
    }
  }
}
