/**
 * @file Construction of the unified GameMaker releases feed from
 * GameMaker's RSS feeds.
 */
import { GameMakerVersionString as V } from '@bscotch/yy/version';
import { channelNames, channels } from './channels.ts';
import { pairingOverrides } from './overrides.ts';
import { releasesSchemaUrl } from './releases.ts';
import { fetchFeed, type FeedEntry } from './rss.ts';
import {
  type ChannelInfo,
  type GameMakerRelease,
  type GameMakerReleasesFeed,
  type Platform,
  releasesFeedSchema,
} from './schemas.ts';

/** The entries of one of GameMaker's RSS feeds. */
export interface FeedSource {
  channel: ChannelInfo;
  /** For IDE feeds, the platform the feed is for */
  platform?: Platform;
  entries: FeedEntry[];
}

export interface FeedSources {
  ide: FeedSource[];
  runtime: FeedSource[];
}

/** A version merged across all of the feeds it appears in. */
export interface MergedArtifact {
  version: string;
  /** Earliest publish date across feeds */
  publishedAt: string;
  /** Channel names, most stable first */
  channels: string[];
  /** Feed URL from the most stable channel */
  feedUrl: string;
  /** For IDEs, installer URLs by platform */
  downloads: Partial<Record<Platform, string>>;
}

export interface BuildReleasesFeedOptions {
  /** IDE → Runtime overrides. Defaults to the package's built-in overrides. */
  overrides?: Readonly<Record<string, string>>;
  /** Override the generation date (for testing) */
  generatedAt?: Date;
}

/** Download all of GameMaker's IDE and Runtime feeds. */
export async function fetchFeedSources(): Promise<FeedSources> {
  const fetchAll = (
    feeds: { channel: ChannelInfo; platform?: Platform; url: string }[],
  ) =>
    Promise.all(
      feeds.map(async ({ url, ...source }) => ({
        ...source,
        entries: await fetchFeed(url),
      })),
    );
  const [ide, runtime] = await Promise.all([
    fetchAll(
      channels.flatMap((channel) =>
        Object.entries(channel.ideFeeds).map(([platform, url]) => ({
          channel,
          platform: platform as Platform,
          url,
        })),
      ),
    ),
    fetchAll(
      channels.flatMap((channel) =>
        channel.runtimeFeeds.map((url) => ({ channel, url })),
      ),
    ),
  ]);
  return { ide, runtime };
}

/**
 * Build the unified GameMaker releases feed from GameMaker's feeds. Throws
 * if anything about GameMaker's data is unexpected (e.g. empty channels or
 * IDEs that can't be paired with a runtime).
 */
export function buildReleasesFeed(
  sources: FeedSources,
  options: BuildReleasesFeedOptions = {},
): GameMakerReleasesFeed {
  const overrides = options.overrides ?? pairingOverrides;
  const ides = mergeArtifacts(sources.ide);
  const runtimes = mergeArtifacts(sources.runtime);

  for (const [ide, runtime] of Object.entries(overrides)) {
    if (!ides.has(ide) || !runtimes.has(runtime)) {
      throw new Error(
        `Pairing override ${ide} → ${runtime} references an unknown IDE or runtime`,
      );
    }
  }
  for (const { name } of channels) {
    if (![...ides.values()].some((ide) => ide.channels.includes(name))) {
      throw new Error(`Channel "${name}" has no IDE releases`);
    }
  }

  const sortedRuntimes = [...runtimes.values()].sort((a, b) =>
    V.compareRaw(a.version, b.version),
  );
  const unpaired: string[] = [];
  const releases: GameMakerRelease[] = [];
  for (const ide of ides.values()) {
    const runtime = overrides[ide.version]
      ? runtimes.get(overrides[ide.version])
      : inferRuntime(ide, sortedRuntimes);
    if (!runtime) {
      unpaired.push(ide.version);
      continue;
    }
    releases.push({
      version: ide.version,
      family: V.family(ide.version),
      channels: ide.channels,
      publishedAt: ide.publishedAt,
      downloads: ide.downloads,
      runtime: {
        kind: 'gms2',
        version: runtime.version,
        publishedAt: runtime.publishedAt,
        channels: runtime.channels,
        feedUrl: runtime.feedUrl,
      },
    });
  }
  if (unpaired.length) {
    throw new Error(
      `Could not find a runtime for ${unpaired.length} IDE version(s): ${unpaired.join(', ')}`,
    );
  }

  releases.sort(
    (a, b) =>
      b.publishedAt.localeCompare(a.publishedAt) ||
      V.compareRaw(b.version, a.version),
  );

  return releasesFeedSchema.parse({
    $schema: releasesSchemaUrl,
    generatedAt: (options.generatedAt ?? new Date()).toISOString(),
    channels,
    releases,
  } satisfies GameMakerReleasesFeed);
}

/**
 * Infer the runtime that pairs with an IDE:
 *
 * 1. Candidates are the runtimes in the IDE's YEAR.MINOR.PATCH family. If
 *    there are none (e.g. an IDE-only patch release like 2024.6.2, which
 *    used a 2024.6.1 runtime), the nearest lower-patch family is used.
 * 2. Candidates are narrowed to those on the IDE's most stable channel
 *    that has any. (So a Beta IDE doesn't get an Unstable-only runtime.)
 * 3. The newest candidate published no later than the IDE is chosen. If
 *    there is no such runtime, the oldest candidate is used instead.
 *
 * @param runtimes All runtimes, sorted by ascending version
 */
export function inferRuntime(
  ide: Pick<MergedArtifact, 'version' | 'publishedAt' | 'channels'>,
  runtimes: MergedArtifact[],
): MergedArtifact | undefined {
  const [year, minor, patch] = V.parse(ide.version);
  let family: MergedArtifact[] = [];
  for (let p = patch; p >= 0 && !family.length; p--) {
    family = runtimes.filter(
      (r) => V.family(r.version) === `${year}.${minor}.${p}`,
    );
  }
  const channel = ide.channels.find((c) =>
    family.some((r) => r.channels.includes(c)),
  );
  const candidates = family.filter(
    (r) => !channel || r.channels.includes(channel),
  );
  return (
    candidates.findLast((r) => r.publishedAt <= ide.publishedAt) ??
    candidates[0]
  );
}

/**
 * Merge feed entries across feeds, so that there is one entry per version.
 * Entries older than their channel's `minVersion` are dropped.
 */
function mergeArtifacts(feeds: FeedSource[]): Map<string, MergedArtifact> {
  const rank = (feed: FeedSource) =>
    channelNames.indexOf(feed.channel.name as (typeof channelNames)[number]);
  // Processing the most stable channels first means that `channels` ends
  // up sorted, and `feedUrl` comes from the most stable channel.
  const sorted = [...feeds].sort((a, b) => rank(a) - rank(b));

  const merged = new Map<string, MergedArtifact>();
  for (const { channel, platform, entries } of sorted) {
    for (const entry of entries) {
      if (
        channel.minVersion &&
        V.compareRaw(entry.version, channel.minVersion) < 0
      ) {
        continue;
      }
      const artifact = merged.get(entry.version) ?? {
        version: entry.version,
        publishedAt: entry.publishedAt,
        channels: [],
        feedUrl: entry.feedUrl,
        downloads: {},
      };
      merged.set(entry.version, artifact);
      if (entry.publishedAt < artifact.publishedAt) {
        artifact.publishedAt = entry.publishedAt;
      }
      if (!artifact.channels.includes(channel.name)) {
        artifact.channels.push(channel.name);
      }
      if (platform && entry.link) {
        artifact.downloads[platform] ??= entry.link;
      }
    }
  }
  return merged;
}
