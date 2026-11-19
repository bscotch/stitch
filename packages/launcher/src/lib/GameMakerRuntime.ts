import { GameMakerComponent } from './GameMakerComponent.ts';
import type { GameMakerInstalledVersion } from './GameMakerLauncher.types.ts';
import {
  executeGameMakerBuildCommand,
  executeGameMakerRuntimeInstallCommand,
} from './GameMakerRuntime.command.ts';
import type {
  GameMakerBuildOptions,
  GameMakerRunOptions,
} from './GameMakerRuntime.types.ts';
import {
  listInstalledRuntimes,
  type Logger,
  sortByDateField,
} from './utility.ts';
export * from './GameMakerRuntime.command.ts';

export class GameMakerRuntime extends GameMakerComponent {
  constructor(info: GameMakerInstalledVersion) {
    super(info);
  }

  async runProject(options: GameMakerRunOptions) {
    return await executeGameMakerBuildCommand(this, options);
  }

  async buildProject(options: GameMakerBuildOptions) {
    return await executeGameMakerBuildCommand(this, {
      ...options,
      compile: true,
    });
  }

  async installRuntime(newVersion: { version: string; feedUrl: string }) {
    return await executeGameMakerRuntimeInstallCommand(this, newVersion);
  }

  static async listInstalled(options?: {
    logger?: Logger;
  }): Promise<GameMakerRuntime[]> {
    // Get the runtime versions that SHOULD be installable
    // for cross-checking and for identifying which channel
    // a runtime is from.
    const releases = await GameMakerComponent.listReleases({
      logger: options?.logger,
    });
    const installedRuntimes = await listInstalledRuntimes({
      logger: options?.logger,
    });
    const runtimes: GameMakerRuntime[] = [];
    for (const runtime of installedRuntimes) {
      const version = releases.find(
        (v) => v.runtime.version === runtime.version,
      );
      runtimes.push(
        new GameMakerRuntime({
          ...runtime,
          channel: version?.channel,
          publishedAt: version?.runtime.publishedAt
            ? new Date(version.publishedAt)
            : undefined,
          feedUrl: version?.runtime.feedUrl,
        }),
      );
    }
    return sortByDateField(runtimes, 'publishedAt');
  }
}
