import { exists } from './fsUtil.ts';
import { resolveOptions, type AnyLauncherOptions } from './options.ts';
import {
  channelsForProgramDirName,
  computeGameMakerDirs,
  knownProgramDirNames,
} from './paths.ts';
import { findActiveUserDir } from './user.ts';

export type GameMakerPathId =
  | 'systemDir'
  | 'runtimesDir'
  | 'ideLogFile'
  | 'defaultMacrosFile'
  | 'runtimeConfigFile'
  | 'runtimeFeedsFile'
  | 'userDir'
  | 'activeUserDir'
  | 'stitchIdeCacheDir'
  | 'stitchDownloadsDir'
  | 'stitchIgorCacheDir'
  | 'stitchStateDir';

export interface GameMakerPath {
  id: GameMakerPathId;
  /** The GameMaker channels the path belongs to (empty for Stitch's own dirs) */
  channels: string[];
  programDirName?: string;
  path: string;
  name: string;
  description: string;
  exists: boolean;
}

/**
 * List important GameMaker and Stitch paths, for UIs that let users open
 * them. GameMaker's paths are listed per `program_dir_name` (channels
 * that share one, like Beta and Unstable, share their paths).
 */
export async function listPaths(
  options?: AnyLauncherOptions,
): Promise<GameMakerPath[]> {
  const opts = resolveOptions(options);
  const p = opts.platform.path;
  const paths: Omit<GameMakerPath, 'exists'>[] = [];
  const programDirNames = [
    ...new Set([...knownProgramDirNames(), ...Object.keys(opts.gameMakerDirs)]),
  ];
  for (const programDirName of programDirNames) {
    const dirs = computeGameMakerDirs(programDirName, opts);
    const channels = channelsForProgramDirName(programDirName);
    const add = (
      id: GameMakerPathId,
      path: string,
      name: string,
      description: string,
    ) => paths.push({ id, channels, programDirName, path, name, description });
    add(
      'systemDir',
      dirs.system,
      'GameMaker: System Dir',
      'IDE-wide data: installed runtimes, config, and logs.',
    );
    add(
      'runtimesDir',
      dirs.runtimes,
      'GameMaker: Runtimes',
      'Runtimes installed by the IDE.',
    );
    add(
      'ideLogFile',
      dirs.ideLog,
      'GameMaker: IDE Log',
      "The IDE's log, from its most recent run.",
    );
    add(
      'defaultMacrosFile',
      dirs.defaultMacros,
      'GameMaker: Macro Overrides',
      "Overrides of the IDE's default macros, such as its update and runtime feed URLs.",
    );
    add(
      'runtimeConfigFile',
      dirs.runtimeConfig,
      'GameMaker: Runtimes List',
      "The IDE's list of installed runtimes, and the active one.",
    );
    add(
      'runtimeFeedsFile',
      dirs.runtimeFeeds,
      'GameMaker: Runtime Feeds',
      'Runtime feeds shown in the IDE preferences.',
    );
    add(
      'userDir',
      dirs.user,
      'GameMaker: User Data',
      'Logins and per-user data.',
    );
    const active = await findActiveUserDir(dirs.user, p.join);
    add(
      'activeUserDir',
      active.dir,
      'GameMaker: Active User',
      active.loggedIn
        ? "The logged-in user's preferences, licence and devices."
        : 'Data used while logged out.',
    );
  }
  const stitch = (
    id: GameMakerPathId,
    path: string,
    name: string,
    description: string,
  ) => paths.push({ id, channels: [], path, name, description });
  stitch(
    'stitchIdeCacheDir',
    opts.ideCacheDir,
    'Stitch: IDE Cache',
    'GameMaker IDE versions extracted by Stitch.',
  );
  stitch(
    'stitchDownloadsDir',
    await opts.downloadsDir(),
    'Stitch: Downloads',
    'Where Stitch downloads official GameMaker installers.',
  );
  stitch(
    'stitchIgorCacheDir',
    opts.igorCacheDir,
    'Stitch: Igor Cache',
    "Igor's per-project build caches.",
  );
  stitch(
    'stitchStateDir',
    opts.stateDir,
    'Stitch: Launcher State',
    "Stitch's launcher state and cached releases feed.",
  );
  return await Promise.all(
    paths.map(async (path) => ({ ...path, exists: await exists(path.path) })),
  );
}
