import { Pathy } from '@bscotch/pathy';
import type { TracedClass } from '@bscotch/utility/browser';
import { ok } from 'assert';
import { GameMakerIde } from './GameMakerIde.js';
import { GameMakerSearch } from './GameMakerLauncher.types.js';
import { GameMakerRuntime } from './GameMakerRuntime.js';
import { GameMakerRunOptions } from './GameMakerRuntime.types.js';
import { bootstrapRuntimeVersion, setActiveRuntime, trace } from './utility.js';

export * from './GameMakerLauncher.types.js';

export interface GameMakerLauncher extends TracedClass {}

@trace
export class GameMakerLauncher {
  /**
   * Open a project with a specified IDE and
   * Runtime version. If only the IDE version is
   * specified, its matching Runtime version will
   * be automatically selected.
   *
   * This method will guarantee that it will
   * *either* successfully open the project with
   * the target versions, or it will throw an error
   * and not open anything. In particular, if a
   * mismatched IDE and Runtime are specified,
   * and the Runtime is not installed, this method
   * will throw an error.
   */
  @trace
  static async openProject(
    projectYypPath: string | Pathy,
    openProjectOptions: {
      ideVersion: string;
      runtimeVersion?: string;
      programFiles?: string;
    },
  ) {
    console.log(
      `Making sure that IDE v${openProjectOptions.ideVersion} is installed...`,
    );
    const ide = await GameMakerIde.install(openProjectOptions.ideVersion, {
      programFiles: openProjectOptions.programFiles,
    });
    return ide.openProject(projectYypPath, openProjectOptions?.runtimeVersion);
  }

  static async runProject(
    target: GameMakerRunOptions,
    runtimeVersion: string,
    options?: {
      /**
       * Runtimes are installed with other runtimes,
       * but many runtimes have a bug or licensing
       * issue preventing them from working. You can
       * specify a specific runtime that *already exists*
       * to use.
       */
      runtimeInstallerVersion?: string;
    },
  ) {
    const runtime = await GameMakerLauncher.installRuntime(
      runtimeVersion,
      options?.runtimeInstallerVersion,
    );
    await setActiveRuntime(runtime);
    return runtime.runProject(target);
  }

  /**
   * List the installed Runtime versions
   * (many Runtime versions can be installed
   * at the same time, from both beta and stable
   * channels). Each Runtime comes with its own
   * GameMaker CLI artifact ("Igor").
   */
  static async listInstalledRuntimes(): Promise<GameMakerRuntime[]> {
    return await GameMakerRuntime.listInstalled();
  }

  static async findInstalledRuntime(
    searchParams?: GameMakerSearch,
  ): Promise<GameMakerRuntime | undefined> {
    const installedRuntimes = await GameMakerLauncher.listInstalledRuntimes();
    const { version, channel } = searchParams || {};
    return installedRuntimes.find(
      (v) =>
        (!version || v.version === version) &&
        (!channel || v.channel === channel),
    );
  }

  /**
   * Install the specified Runtime version. Many
   * Runtime versions can be installed at the same
   * time. Installing a runtime makes it available
   * to be used, but does not make it the *active*
   * Runtime.
   *
   * @param usingVersion - Runtimes are installed using other runtimes. This parameter specifies which runtime to use to install the new one. If not provided, will try to use an existing installed runtime.
   */
  static async installRuntime(
    version: string,
    usingVersion = bootstrapRuntimeVersion,
  ): Promise<GameMakerRuntime> {
    // See if we've already got it installed
    let matchingRuntime = await GameMakerLauncher.findInstalledRuntime({
      version,
    });
    if (matchingRuntime) {
      console.log('Runtime', version, 'is already installed');
      return matchingRuntime;
    }
    const release = await GameMakerRuntime.findRelease({
      runtimeVersion: version,
    });
    ok(release, `Could not find runtime version ${version} in the feeds.`);

    // Otherwise we need to install it using an existing
    // runtime
    const otherRuntime = await GameMakerLauncher.findInstalledRuntime({
      version: usingVersion,
    });
    ok(
      otherRuntime,
      `Could not find an existing runtime to use to install the new runtime.`,
    );

    // Use this runtime to install the new runtime
    const { stdout, compilerLogsPath } = await otherRuntime.installRuntime(
      release.runtime,
    );
    ok(
      !stdout.includes('License is invalid - Out of Date'),
      'GameMaker CLI failed due to expired credentials. This can be caused by using a runtime that requires Enterprise credentials, or by using a runtime with a bug. Runtime v2022.300.0.476 is known to work -- you can install it via the IDE and use it for future programmatic installs.',
    );
    ok(
      stdout.includes('Verification Complete') &&
        stdout.includes('Igor complete'),
      `Runtime installation failed. Check the logs at ${compilerLogsPath}`,
    );

    // Make sure it's actually installed
    matchingRuntime = await GameMakerLauncher.findInstalledRuntime({
      version,
      channel: release.channel,
    });
    ok(matchingRuntime, 'Could not find runtime after installation');
    return matchingRuntime;
  }
}
