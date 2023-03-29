import { GameMakerComponent } from './GameMakerComponent.js';
import type { GameMakerInstalledVersion } from './GameMakerLauncher.types.js';
import {
  executeGameMakerBuildCommand,
  executeGameMakerRuntimeInstallCommand,
} from './GameMakerRuntime.command.js';
import type {
  GameMakerBuildOptions,
  GameMakerRunOptions,
} from './GameMakerRuntime.types.js';
import { listInstalledRuntimes, sortByDateField } from './utility.js';
export * from './GameMakerRuntime.command.js';

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

  static async listInstalled(): Promise<GameMakerRuntime[]> {
    // Get the runtime versions that SHOULD be installable
    // for cross-checking and for identifying which channel
    // a runtime is from.
    const releases = await GameMakerComponent.listReleases();
    const installedRuntimes = await listInstalledRuntimes();
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
