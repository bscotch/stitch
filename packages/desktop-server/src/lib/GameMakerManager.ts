import { Pathy } from '@bscotch/pathy';
import {
  gameMakerChannelSchema,
  GameMakerFeedOptions,
  GameMakerIde,
  GameMakerRunningIde,
  GameMakerRuntime,
} from '@bscotch/stitch-launcher';
import { MaxAge, sequential } from '@bscotch/utility';
import { z } from 'zod';
import { createEventEmitter } from './events.js';
import { IdeInstallEventPayload, IdeInstallStep } from './schemas.js';
import {
  type GameMakerReleaseWithNotes,
  gameMakerReleaseWithNotesSchema,
} from '@bscotch/gamemaker-releases';

const gameMakerEmitter = createEventEmitter<{
  ideInstallStep: IdeInstallEventPayload;
}>();

export type GameMakerVersionData = z.infer<typeof gameMakerVersionSchema>;

const notesSchema = gameMakerReleaseWithNotesSchema.shape.ide.shape.notes;

const componentSchema = z.object({
  version: z.string(),
  publishedAt: z.string(),
  installed: z.boolean(),
  notes: notesSchema,
});

const gameMakerVersionSchema = z.object({
  channel: gameMakerChannelSchema,
  publishedAt: z.string(),
  version: z.string(),
  ide: componentSchema,
  runtime: componentSchema,
  summary: z.string(),
});

export class GameMakerVersion {
  static readonly schema = gameMakerVersionSchema;

  constructor(
    readonly release: GameMakerReleaseWithNotes,
    readonly ideInstall: GameMakerIde | undefined,
    readonly runtimeInstall: GameMakerRuntime | undefined,
  ) {}

  get version() {
    return this.release.ide.version;
  }

  get runtimeVersion() {
    return this.release.runtime.version;
  }

  toJSON() {
    return GameMakerVersion.schema.parse({
      ...this.release,
      version: this.release.ide.version,
      ide: {
        ...this.release.ide,
        installed: !!this.ideInstall,
      },
      runtime: {
        ...this.release.runtime,
        installed: !!this.runtimeInstall,
      },
    });
  }
}

/**
 * For managing stuff related to the GameMaker IDE and runtime applications
 */
export class GameMakerManager {
  protected static readonly emitter = gameMakerEmitter;

  static onOpenStepChanged(
    listener: (payload: IdeInstallEventPayload) => void,
  ) {
    GameMakerManager.emitter.on('ideInstallStep', listener);
    return () => GameMakerManager.emitter.off('ideInstallStep', listener);
  }

  protected static openedProjects: Map<
    string,
    Promise<GameMakerRunningIde | void>
  > = new Map();

  protected static emit(step: IdeInstallStep, version: string) {
    GameMakerManager.emitter.emit('ideInstallStep', {
      version,
      step,
    });
  }

  static async openProject(
    projectPath: string,
    ideVersion: string,
    options: {
      programFiles?: string;
    },
  ) {
    // Check to see if we already are running this project
    projectPath = Pathy.normalize(projectPath);
    if (!GameMakerManager.openedProjects.has(projectPath)) {
      const eventuallyTheOpenedProject = this.ensureIde(
        ideVersion,
        options,
      ).then((ide) =>
        ide.openProject(projectPath).catch((reason) => {
          if (reason instanceof GameMakerIde.error) {
            if (reason.code === 'LOGIN_REQUIRED') {
              GameMakerManager.emit('login_required', ideVersion);
            }
          }
          GameMakerManager.emit('failed', ideVersion);
          return;
        }),
      );

      GameMakerManager.openedProjects.set(
        projectPath,
        // A promise that resolves to a running IDE once
        // we ensure that the IDE is installed
        eventuallyTheOpenedProject,
      );
    }
    const runningIde = await GameMakerManager.openedProjects.get(projectPath);
    void runningIde?.waitForClose().then(() => {
      GameMakerManager.openedProjects.delete(projectPath);
      GameMakerManager.emit('closed', ideVersion);
    });
    GameMakerManager.emit('opened', ideVersion);
    return runningIde;
  }

  protected static async ensureIde(
    ideVersion: string,
    options: { programFiles?: string },
  ) {
    return (
      (await GameMakerManager.findInstalledIde(ideVersion)) ||
      (await GameMakerManager.install(ideVersion, options))
    );
  }

  protected static async findInstalledIde(version: string) {
    GameMakerManager.emit('searchingLocal', version);
    const ide = await GameMakerIde.findInstalled(version);
    if (ide) {
      GameMakerManager.emit('installed', version);
    }
    return ide;
  }

  @sequential
  protected static async install(
    version: string,
    options: { programFiles?: string },
  ) {
    GameMakerManager.emit('installing', version);
    const ide = await GameMakerIde.install(version, options);
    GameMakerManager.emit('installed', version);
    return ide;
  }

  /**
   * List all GameMaker IDE versions and associated local information,
   * such as whether it's installed or not, which runtime it's paired with,
   * (if known), etc.
   */
  // @MaxAge(300, 150)
  @MaxAge(60, 180)
  static async versions(
    options?: GameMakerFeedOptions,
  ): Promise<GameMakerVersion[]> {
    const versions: GameMakerVersion[] = [];
    const [releases, idesInstalled, runtimesInstalled] = await Promise.all([
      GameMakerIde.listReleases(options),
      GameMakerIde.listInstalled(),
      GameMakerRuntime.listInstalled(),
    ]);

    // For each IDE, see if it's installed, what its paired runtime is, etc
    for (const release of releases) {
      const version = new GameMakerVersion(
        release,
        idesInstalled.find((i) => i.version === release.ide.version),
        runtimesInstalled.find((i) => i.version === release.runtime.version),
      );
      versions.push(version);
    }
    return versions;
  }

  @MaxAge(300, 150)
  static async listWellKnownPaths(options?: { programFiles?: string }) {
    const paths = await GameMakerIde.listWellKnownPaths(options);
    return paths;
  }
}
