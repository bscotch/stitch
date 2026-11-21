import {
  fetchReleasesFeed,
  releasesFeedSchema,
  releasesUrl,
  type GameMakerRelease,
  type GameMakerReleasesFeed,
} from '@bscotch/gamemaker-releases';
import { GameMakerVersionString } from '@bscotch/yy/version';
import { readFile, stat } from 'node:fs/promises';
import { LauncherError } from './errors.ts';
import { stripBom, writeJsonAtomic } from './fsUtil.ts';
import {
  resolveOptions,
  type AnyLauncherOptions,
  type ResolvedOptions,
} from './options.ts';

/**
 * Normalize a GameMaker version string (removing a leading "v" and
 * leading zeroes), throwing if it isn't one.
 */
export function normalizeVersion(version: string): string {
  const cleaned = version.trim().replace(/^v/i, '');
  if (!/^\d+\.\d+\.\d+\.\d+$/.test(cleaned)) {
    throw new Error(`Invalid GameMaker version string: "${version}"`);
  }
  return GameMakerVersionString.normalize(cleaned);
}

const memoryCache = new Map<
  string,
  { feed: GameMakerReleasesFeed; fetchedAt: number }
>();

/**
 * Get Stitch's v2 GameMaker releases feed. Fetched feeds are cached in
 * memory and on disk (in the state dir) for `feedMaxAgeSeconds`. If a
 * fetch fails, a stale cached copy is used instead, if there is one.
 */
export async function getReleasesFeed(
  options?: AnyLauncherOptions,
): Promise<GameMakerReleasesFeed> {
  const opts = resolveOptions(options);
  if (opts.feed) return opts.feed;
  const url = opts.feedUrl ?? releasesUrl;
  const maxAgeMs = opts.feedMaxAgeSeconds * 1000;
  const cacheFile = opts.platform.path.join(opts.stateDir, 'releases.v2.json');
  const cacheKey = `${url}|${cacheFile}`;

  const inMemory = memoryCache.get(cacheKey);
  if (inMemory && Date.now() - inMemory.fetchedAt < maxAgeMs) {
    return inMemory.feed;
  }

  const onDisk = await readCachedFeed(cacheFile);
  if (
    onDisk &&
    onDisk.url === url &&
    Date.now() - onDisk.fetchedAt < maxAgeMs
  ) {
    memoryCache.set(cacheKey, onDisk);
    return onDisk.feed;
  }

  try {
    const feed = await fetchReleasesFeed(url);
    const entry = { feed, fetchedAt: Date.now() };
    memoryCache.set(cacheKey, entry);
    await writeCachedFeed(cacheFile, { ...entry, url }).catch((err) =>
      opts.logger.warn('Could not cache the GameMaker releases feed', err),
    );
    return feed;
  } catch (err) {
    const stale = inMemory ?? (onDisk?.url === url ? onDisk : undefined);
    if (stale) {
      opts.logger.warn(
        `Could not fetch the GameMaker releases feed, using a copy from ${new Date(stale.fetchedAt).toISOString()}`,
        err,
      );
      return stale.feed;
    }
    throw new LauncherError(
      'FEED_UNAVAILABLE',
      `Could not fetch the GameMaker releases feed from ${url}.`,
      { url },
      { cause: err },
    );
  }
}

/** Like {@link getReleasesFeed}, but returns `undefined` on failure */
export async function tryGetReleasesFeed(
  options: ResolvedOptions,
): Promise<GameMakerReleasesFeed | undefined> {
  try {
    return await getReleasesFeed(options);
  } catch (err) {
    options.logger.warn((err as Error).message);
    return;
  }
}

export function findRelease(
  feed: GameMakerReleasesFeed | undefined,
  ideVersion: string,
): GameMakerRelease | undefined {
  return feed?.releases.find((r) => r.version === ideVersion);
}

/** For tests: forget feeds cached in memory */
export function clearFeedMemoryCache() {
  memoryCache.clear();
}

interface CachedFeedFile {
  url: string;
  fetchedAt: number;
  feed: GameMakerReleasesFeed;
}

async function readCachedFeed(
  file: string,
): Promise<CachedFeedFile | undefined> {
  try {
    const [content, info] = await Promise.all([
      readFile(file, 'utf8'),
      stat(file),
    ]);
    const parsed = JSON.parse(stripBom(content)) as Partial<CachedFeedFile>;
    return {
      url: String(parsed.url),
      fetchedAt:
        typeof parsed.fetchedAt === 'number' ? parsed.fetchedAt : info.mtimeMs,
      feed: releasesFeedSchema.parse(parsed.feed),
    };
  } catch {
    return;
  }
}

async function writeCachedFeed(file: string, data: CachedFeedFile) {
  await writeJsonAtomic(file, data);
}
