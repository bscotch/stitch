import { Pathy } from '@bscotch/pathy';
import { ok } from 'assert';
import { ChildProcess, exec } from 'child_process';
import { GameMakerComponent } from './GameMakerComponent.js';
import type {
  GameMakerDefaultMacros,
  GameMakerInstalledVersion,
} from './GameMakerLauncher.types.js';
import {
  cleanVersionString,
  createStaticTracer,
  download,
  listDefaultMacrosPaths,
  listInstalledIdes,
  listInstalledRuntimes,
  runIdeInstaller,
  setActiveRuntime,
  trace,
} from './utility.js';

import { TracedClass } from '@bscotch/utility/browser';
import { logger } from './log.js';

export interface GameMakerIde extends TracedClass {}

export interface GameMakerIdeInstallOptions {
  /**
   * Specify a non-default program files directory
   * if your IDE installs do not go to the default.
   *
   * This is required if you've ever manually installed
   * GameMaker and chosen a non-default program files
   * root directory.
   *
   * @default process.env.PROGRAMFILES
   */
  programFiles?: string;
  /**
   * If true, the installer will be downloaded
   * and run even if it is already evailable
   */
  force?: boolean;
}

export class GameMakerRunningIde {
  protected process: ChildProcess;
  constructor(
    readonly exePath: string,
    readonly projectYypPath: string,
    readonly runtimeVersion: string,
  ) {
    this.process = exec(`"${exePath}" "${projectYypPath}"`);
  }

  waitForClose<T>(cb?: () => T): Promise<T> {
    return new Promise((resolve) => {
      const events = ['exit', 'close', 'disconnect', 'error'];
      const callback = () => {
        events.forEach((event) => this.process.off(event, callback));
        return resolve(cb?.() as any);
      };
      events.forEach((event) => this.process.on(event, callback));
    });
  }

  close() {
    this.process.kill();
  }
}

const ideClassStaticTracer = (methodName: string) =>
  createStaticTracer('GameMakerIde', methodName);

export type GameMakerIdeErrorCode =
  | 'LOGIN_REQUIRED'
  | 'RUNTIME_NOT_FOUND'
  | 'IDE_NOT_FOUND'
  | 'UNKNOWN';

export class GameMakerIdeError extends Error {
  constructor(message: string, readonly code: GameMakerIdeErrorCode) {
    super(message);
    this.name = 'GameMakerIdeError';
    Error.captureStackTrace(this, this.constructor);
  }
}

export function assert(
  claim: any,
  message = 'Assertion failed',
  code: GameMakerIdeErrorCode = 'UNKNOWN',
): asserts claim {
  if (!claim) {
    throw new GameMakerIdeError(message, code);
  }
}

@trace
export class GameMakerIde extends GameMakerComponent {
  static readonly error = GameMakerIdeError;

  constructor(info: GameMakerInstalledVersion) {
    super(info);
  }

  async openProject(projectYypPath: string | Pathy, runtimeVersion?: string) {
    const projectPath = Pathy.asInstance(projectYypPath);
    const user = await this.activeUser();
    assert(user, 'No active user', 'LOGIN_REQUIRED');

    const pairedRuntimeVersion = await this.pairedRuntimeVersion();
    runtimeVersion ||= pairedRuntimeVersion;
    assert(
      runtimeVersion,
      `Could not find a runtime version for IDE v${this.version}, and none was specified.`,
      'RUNTIME_NOT_FOUND',
    );
    // Assert that this runtime version is in the feed
    const release = await GameMakerComponent.findRelease({ runtimeVersion });
    assert(
      release,
      `Could not find runtime version ${runtimeVersion}`,
      'RUNTIME_NOT_FOUND',
    );

    // If the runtime version is the paired one,
    // and it is not already installed, then the IDE
    // will install on boot and set it to active.
    // Therefore we can either do NOTHING, or just
    // need to unset the runtime.json>active field.
    const installedRuntime = (await listInstalledRuntimes()).find(
      (r) => r.version === runtimeVersion,
    );
    if (installedRuntime) {
      await setActiveRuntime(installedRuntime);
    }
    assert(
      installedRuntime || runtimeVersion === pairedRuntimeVersion,
      `The specified Runtime was neither already installed nor a match for the specified IDE.`,
      'RUNTIME_NOT_FOUND',
    );

    // Open the project with the given IDE
    console.log(
      `Opening project "${projectYypPath}" using IDE v${this.version} with Runtime v${runtimeVersion}.\n\nThe window might take a few seconds to appear, and might not steal focus!\n\nThis command will exit when the IDE is closed.`,
    );

    // Prevent the IDE from annoying the user with
    // suggestions to update.
    await GameMakerIde.disableUpdatePrompt();
    await GameMakerComponent.ensureOfficialRuntimeFeeds();

    return new GameMakerRunningIde(
      this.executablePath.absolute,
      projectPath.toString({ format: 'win32' }),
      runtimeVersion,
    );
  }

  /**
   * Each GameMaker IDE lists the runtime version
   * that it is paired with. In theory this is the
   * most-compatible runtime version.
   */
  async pairedRuntimeVersion() {
    const runtimeVersionFile = this.directory.join<string>('matching.runtime');
    // Get the value specified in the actual install (this is the most-correct one)
    if (await runtimeVersionFile.exists()) {
      const version = (await runtimeVersionFile.read()).trim();
      ok(
        version.match(/^\d+\.\d+\.\d+\.\d+$/),
        `Invalid runtime version: ${version}`,
      );
      return version;
    }
    // If that fails, fall back on the version in the feed
    const release = await GameMakerComponent.findRelease({
      ideVersion: this.version,
    });
    assert(release, `Could not find release for IDE v${this.version}`);
    return release?.runtime.version;
  }

  /**
   * Install the specified IDE version. Only
   * one IDE version can be installed at a time
   * (per stable and beta channels), so this
   * may clobber the currently-installed IDE.
   *
   * If this version is already installed, no action
   * is taken. If this version's installer is already
   * downloaded, it will not be re-downloaded. If it
   * is *not* downloaded, then it will be downloaded.
   */
  @trace
  static async install(
    version: string,
    options?: GameMakerIdeInstallOptions,
  ): Promise<GameMakerIde> {
    version = cleanVersionString(version);
    const release = await GameMakerComponent.findRelease({
      ideVersion: version,
    });
    ok(release, `Could not find version ${version} in the IDE feed`);
    ok(
      release.ide.link,
      `Could not find a download link for version ${version}`,
    );
    let installedVersion = await GameMakerIde.findInstalled(version);
    if (!installedVersion || options?.force) {
      // See if it's installed to PROGRAMFILES,
      // just not yet to Stitch.
      let directlyInstalled = await GameMakerIde.findDirectlyInstalled(
        version,
        options?.programFiles,
      );
      if (!directlyInstalled || options?.force) {
        // Download & install!
        const installerPath = GameMakerIde.cachedIdeInstallerPath(version);
        await download(release.ide.link, installerPath);
        await runIdeInstaller(installerPath);
        // Make sure this version is now installed
        directlyInstalled = await GameMakerIde.findDirectlyInstalled(
          version,
          options?.programFiles,
        );
        ok(
          directlyInstalled,
          `Could not find version ${version} after installation. Installation might have gone to an unexpected location or the installer might have failed.`,
        );
        await installerPath.delete();
      }
      // Copy over to Stitch
      console.log("Copying installed files to Stitch's cache...");
      await directlyInstalled.directory.copy(
        GameMakerIde.cachedIdeDirectory(version),
      );
      installedVersion = await GameMakerIde.findInstalled(version);
    }
    ok(
      installedVersion,
      `Could not find version ${version} after installation.`,
    );
    return installedVersion;
  }

  @trace
  static async findInstalled(version: string) {
    const installedIdeVersions = await GameMakerIde.listInstalled();
    return installedIdeVersions.find((v) => v.version === version);
  }

  @trace
  static async listInstalled() {
    await GameMakerIde.defaultCachedIdeParentDirectory.ensureDirectory();
    return await GameMakerIde.listInstalledInDir(
      GameMakerIde.defaultCachedIdeParentDirectory,
    );
  }

  /**
   * Prevent the IDE from showing an update prompt on boot.
   */
  protected static async disableUpdatePrompt() {
    const macroFilePaths = await listDefaultMacrosPaths();
    for (const path of macroFilePaths) {
      const macros: GameMakerDefaultMacros = (await path.exists())
        ? await path.read()
        : {};
      // Set it to a syntactically correct, but
      // non-existent RSS feed.
      macros.updateURI =
        'http://gms.yoyogames.com/update-win-NuBeta-TOTALLY-FAKE.rss';
      await path.write(macros);
    }
  }

  @trace
  protected static async findDirectlyInstalled(
    version: string,
    programFiles?: string,
  ) {
    const installedIdeVersions = await GameMakerIde.listDirectlyInstalled(
      programFiles,
    );
    return installedIdeVersions.find((v) => v.version === version);
  }

  /**
   * Check PROGRAMFILES for installed IDE versions. These are the result of running
   * the GameMaker IDE installers. The installed
   * content end up being separately cached by
   * Stitch to allow parallel installs
   * (see {@link listInstalled}).
   */
  @trace
  protected static async listDirectlyInstalled(
    programFiles = process.env.PROGRAMFILES!,
  ) {
    return await GameMakerIde.listInstalledInDir(programFiles);
  }

  @trace
  protected static async listInstalledInDir(
    parentDir: string | Pathy,
  ): Promise<GameMakerIde[]> {
    const tracer = ideClassStaticTracer('listInstalledInDir');
    const releases = await GameMakerIde.listReleases();
    tracer(`Searching for folders with GameMaker .exe files in "${parentDir}"`);
    const ideExecutables = await listInstalledIdes(parentDir);
    tracer(`Found ${ideExecutables.length} GameMaker .exe files`);

    const ideVersions: (GameMakerIde | undefined)[] = await Promise.all(
      ideExecutables.map(async (executablePath) => {
        const possibleFileNames =
          /^(IDE|GameMaker(Studio2?)?(-(Beta|LTS))?)\.dll$/;
        const parentDir = executablePath.up();
        tracer(
          `Parsing version information from GameMaker installation in "${parentDir}"`,
        );

        const dllFile = (await parentDir.listChildren()).filter((p) => {
          const match = p.basename.match(possibleFileNames);
          return !!match;
        })[0];
        ok(
          await dllFile?.exists(),
          `Could not find DLL file for ${executablePath}`,
        );
        // The main DLL file is binary, but it contains
        // plaintext version strings for the IDE version.
        const version = (await dllFile.read<string>()).match(
          /\b((23|2|20\d{2})\.\d{1,4}\.\d{1,4}\.\d{1,4})\b/u,
        )?.[1];
        ok(version, `Could not find a version string in ${dllFile.absolute}`);
        const matchingFeedVersion = releases.find(
          (v) => v.ide.version === version,
        );
        if (!matchingFeedVersion) {
          logger.warn(
            `Found local install of GameMaker ${version}, but that version is not in the feed.`,
          );
          return;
        }
        return new GameMakerIde({
          version,
          channel: matchingFeedVersion.channel,
          executablePath,
          directory: executablePath.up(),
          publishedAt: new Date(matchingFeedVersion.publishedAt),
          feedUrl: matchingFeedVersion.ide.feedUrl,
        });
      }),
    );
    return ideVersions.filter((v) => v) as GameMakerIde[];
  }

  /**
   * The parent folder inside of which all IDE
   * installs are cached in their own separate
   * folders. For the path to a specific IDE
   * version, use {@link cachedIdeDirectory}.
   */
  static get defaultCachedIdeParentDirectory() {
    return GameMakerIde.cacheDir.join('ide');
  }

  static cachedIdeInstallerPath(version: string) {
    return GameMakerIde.defaultCachedIdeParentDirectory.join(
      `gamemaker-${version}.exe`,
    );
  }

  static cachedIdeDirectory(version: string) {
    return GameMakerIde.defaultCachedIdeParentDirectory.join(
      `gamemaker-${version}`,
    );
  }
}
