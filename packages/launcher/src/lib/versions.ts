import type { Platform } from '@bscotch/gamemaker-releases';
import { LauncherError } from './errors.ts';
import { findRelease, getReleasesFeed, normalizeVersion } from './feed.ts';
import { findIde, type CachedIde } from './ideCache.ts';
import { resolveOptions, type AnyLauncherOptions } from './options.ts';
import {
  computeGameMakerDirs,
  programDirNameForChannel,
  type GameMakerDirs,
} from './paths.ts';

export interface IdeVersionDetails {
  ideVersion: string;
  /** The most stable channel the version was released on */
  channel: string;
  /** Every channel it was released on, most stable first */
  channels: string[];
  publishedAt?: string;
  /** Whether the releases feed lists this version */
  inFeed: boolean;
  /** Whether it can be downloaded for this OS */
  installable: boolean;
  downloads: Partial<Record<Platform, string>>;
  /** The cached copy, if there is one */
  cached?: CachedIde;
  /** The runtime to use with this IDE */
  runtimeVersion: string;
  /**
   * Where `runtimeVersion` came from: an explicit override, the cached
   * IDE's `matching.runtime` (what the IDE itself installs), or the feed's
   * inferred pairing.
   */
  runtimeVersionSource: 'override' | 'matching.runtime' | 'feed';
  /** GameMaker's dirs for this IDE */
  dirs: GameMakerDirs;
}

/**
 * Everything known about an IDE version, from the releases feed and
 * Stitch's IDE cache. Works offline for cached IDEs.
 */
export async function getIdeVersionDetails(
  ideVersion: string,
  options?: AnyLauncherOptions & {
    /** A runtime version to use instead of the IDE's paired one */
    runtimeVersion?: string;
  },
): Promise<IdeVersionDetails> {
  const opts = resolveOptions(options);
  const version = normalizeVersion(ideVersion);
  const [feed, cached] = await Promise.all([
    getReleasesFeed(opts).catch((err) => {
      opts.logger.warn((err as Error).message);
      return undefined;
    }),
    findIde(version, opts),
  ]);
  const release = findRelease(feed, version);
  if (!release && !cached) {
    throw new LauncherError(
      'IDE_NOT_FOUND',
      feed
        ? `GameMaker IDE v${version} is not in the releases feed, and is not in Stitch's IDE cache.`
        : `GameMaker IDE v${version} is not in Stitch's IDE cache, and the releases feed is unavailable.`,
      { ideVersion: version },
    );
  }

  const channel = release?.channels[0] ?? cached!.channel;
  const programDirName =
    cached?.programDirName ??
    programDirNameForChannel(channel, feed?.channels) ??
    programDirNameForChannel(channel);
  if (!programDirName) {
    throw new LauncherError(
      'IDE_NOT_FOUND',
      `Unknown GameMaker channel "${channel}" for IDE v${version}. Stitch may need to be updated.`,
      { ideVersion: version },
    );
  }

  const override = options?.runtimeVersion?.trim();
  let runtimeVersion: string;
  let runtimeVersionSource: IdeVersionDetails['runtimeVersionSource'];
  if (override) {
    runtimeVersion = normalizeVersion(override);
    runtimeVersionSource = 'override';
  } else if (cached?.pairedRuntimeVersion) {
    runtimeVersion = cached.pairedRuntimeVersion;
    runtimeVersionSource = 'matching.runtime';
  } else if (release) {
    runtimeVersion = release.runtime.version;
    runtimeVersionSource = 'feed';
  } else {
    throw new LauncherError(
      'RUNTIME_NOT_FOUND',
      `Could not determine the runtime version for IDE v${version}: its cached copy has no matching.runtime file, and it's not in the releases feed.`,
      { runtimeVersion: '' },
    );
  }

  return {
    ideVersion: version,
    channel,
    channels: release?.channels ?? cached!.channels,
    publishedAt: release?.publishedAt,
    inFeed: !!release,
    installable: !!release?.downloads[opts.platform.feedPlatform],
    downloads: release?.downloads ?? {},
    cached,
    runtimeVersion,
    runtimeVersionSource,
    dirs: computeGameMakerDirs(programDirName, opts),
  };
}
