import type { GameMakerReleasesFeed } from '@bscotch/gamemaker-releases';
import {
  currentPlatformEnv,
  getPlatformLayer,
  type OsName,
  type PlatformEnv,
  type PlatformLayer,
} from './platform/index.ts';

export interface LauncherLogger {
  info(...args: unknown[]): void;
  warn(...args: unknown[]): void;
  error(...args: unknown[]): void;
  debug?(...args: unknown[]): void;
}

/**
 * Options shared by every launcher function. All are optional. Empty
 * strings are treated as "not set", so callers can pass settings straight
 * through.
 */
export interface LauncherOptions {
  /**
   * Where Stitch keeps its extracted IDEs, one `gamemaker-<version>` dir
   * per version. These can add up to many GB.
   * @default "~/.stitch/launcher/ide"
   */
  ideCacheDir?: string;
  /**
   * Where official installers are downloaded to. Existing files are reused.
   * @default The OS's Downloads folder
   */
  downloadsDir?: string;
  /**
   * Path to a *full* 7-Zip build (`7z.exe` with its `7z.dll` on Windows,
   * `7zz` on macOS), which unpacks installers on those OSes. The standalone
   * `7za` build can't unpack them. Unused on Linux, where installers are
   * unpacked without external tools.
   * @default Found on the PATH or in its usual install location
   */
  sevenZipPath?: string;
  /**
   * Where Igor's per-project cache, temp and output dirs go.
   * @default The OS's cache dir + `stitch/igor`
   */
  igorCacheDir?: string;
  /**
   * Igor cache entries unused for this many days are removed whenever
   * Igor is run. `0` disables automatic pruning.
   * @default 14
   */
  igorCacheMaxAgeDays?: number;
  /**
   * Where Stitch keeps launcher state (the update-prompt backups and the
   * cached releases feed).
   * @default "~/.stitch/launcher"
   */
  stateDir?: string;
  /** Use this releases feed instead of fetching one (for tests, or offline use) */
  feed?: GameMakerReleasesFeed;
  /** A different URL for the v2 releases feed */
  feedUrl?: string;
  /** How long a fetched feed is reused before re-fetching. @default 1800 */
  feedMaxAgeSeconds?: number;
  /**
   * Overrides for GameMaker's system and user dirs, keyed by
   * `program_dir_name` (e.g. "GameMakerStudio2-Beta"). Only needed for
   * unusual setups.
   */
  gameMakerDirs?: Record<string, { system?: string; user?: string }>;
  logger?: LauncherLogger;
  /** Compute paths for another OS. For tests. */
  os?: OsName;
  /** Use another environment (home dir, env vars, arch). For tests. */
  platformEnv?: PlatformEnv;
}

export interface ResolvedOptions {
  /** Marks options that have already been resolved */
  readonly resolved: true;
  platform: PlatformLayer;
  env: PlatformEnv;
  ideCacheDir: string;
  stateDir: string;
  igorCacheDir: string;
  igorCacheMaxAgeDays: number;
  sevenZipPath?: string;
  /** Resolved lazily, since it can require a registry lookup */
  downloadsDir: () => Promise<string>;
  feed?: GameMakerReleasesFeed;
  feedUrl?: string;
  feedMaxAgeSeconds: number;
  gameMakerDirs: Record<string, { system?: string; user?: string }>;
  logger: LauncherLogger;
}

const ignore = () => undefined;

const defaultLogger: LauncherLogger = {
  info: ignore,
  warn: (...args) => console.warn(...args),
  error: (...args) => console.error(...args),
};

const unset = (value: string | undefined) => value?.trim() || undefined;

/** Options as accepted by public functions: raw, or already resolved */
export type AnyLauncherOptions = LauncherOptions | ResolvedOptions;

export function resolveOptions(options?: AnyLauncherOptions): ResolvedOptions {
  if (options && 'resolved' in options && options.resolved === true) {
    return options;
  }
  const opts = (options || {}) as LauncherOptions;
  const platform = getPlatformLayer(opts.os);
  const env = opts.platformEnv ?? currentPlatformEnv();
  const p = platform.path;
  const stateDir =
    unset(opts.stateDir) ?? p.join(env.homedir, '.stitch', 'launcher');
  const downloadsOverride = unset(opts.downloadsDir);
  let downloads: Promise<string> | undefined;
  return {
    resolved: true,
    platform,
    env,
    stateDir,
    ideCacheDir: unset(opts.ideCacheDir) ?? p.join(stateDir, 'ide'),
    igorCacheDir: unset(opts.igorCacheDir) ?? platform.defaultIgorCacheDir(env),
    igorCacheMaxAgeDays: opts.igorCacheMaxAgeDays ?? 14,
    sevenZipPath: unset(opts.sevenZipPath),
    downloadsDir: () =>
      downloadsOverride
        ? Promise.resolve(downloadsOverride)
        : (downloads ??= platform.defaultDownloadsDir(env)),
    feed: opts.feed,
    feedUrl: unset(opts.feedUrl),
    feedMaxAgeSeconds: opts.feedMaxAgeSeconds ?? 1800,
    gameMakerDirs: opts.gameMakerDirs ?? {},
    logger: opts.logger ?? defaultLogger,
  };
}
