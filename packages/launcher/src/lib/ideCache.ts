/**
 * @file Stitch's cache of extracted GameMaker IDEs. Stitch only ever uses
 * IDEs from this cache, never the user's own installs.
 */
import type { GameMakerReleasesFeed } from '@bscotch/gamemaker-releases';
import { GameMakerVersionString } from '@bscotch/yy/version';
import { readdir, readFile, rm, stat } from 'node:fs/promises';
import { LauncherError } from './errors.ts';
import { findRelease, normalizeVersion, tryGetReleasesFeed } from './feed.ts';
import { dirSize, exists } from './fsUtil.ts';
import {
  resolveOptions,
  type AnyLauncherOptions,
  type ResolvedOptions,
} from './options.ts';
import {
  cachedIdeDirName,
  channelForProgramDirName,
  channelsForProgramDirName,
} from './paths.ts';

export interface CachedIde {
  version: string;
  /** The most stable channel this version was released on */
  channel: string;
  /** All channels this version was released on, most stable first */
  channels: string[];
  /**
   * The name GameMaker uses for this IDE's system and user dirs, e.g.
   * "GameMakerStudio2-Beta". Detected from the cached files.
   */
  programDirName: string;
  /** The cached `gamemaker-<version>` dir */
  directory: string;
  executable: string;
  /** The working dir to run the executable in */
  cwd: string;
  /** The help-docs keywords file, if the IDE has one */
  helpKeywordsFile: string;
  /** From the IDE's `matching.runtime`: what the IDE installs on boot */
  pairedRuntimeVersion?: string;
  publishedAt?: string;
  /** Whether the releases feed lists this version */
  inFeed: boolean;
  /**
   * Whether this version can be downloaded again for this OS. Cached
   * copies of versions that can't are irreplaceable. `false` when the
   * feed is unavailable.
   */
  installable: boolean;
}

export type CachedIdeWithSize = CachedIde & { sizeBytes: number };

/** Dirs being extracted into, which never count as installed */
export const tmpDirPrefix = '.tmp-';

export async function readMatchingRuntime(
  file: string,
): Promise<string | undefined> {
  try {
    return normalizeVersion(await readFile(file, 'utf8'));
  } catch {
    return;
  }
}

export async function readCachedIde(
  directory: string,
  version: string,
  feed: GameMakerReleasesFeed | undefined,
  opts: ResolvedOptions,
): Promise<CachedIde | undefined> {
  const layout = await opts.platform.resolveIdeLayout(directory, opts.env.arch);
  if (!layout || !(await exists(layout.executable))) return;
  const release = findRelease(feed, version);
  const channelInfos = feed?.channels;
  const channels = release?.channels.length
    ? release.channels
    : channelsForProgramDirName(layout.programDirName, channelInfos);
  const channel =
    release?.channels[0] ??
    channelForProgramDirName(layout.programDirName, channelInfos) ??
    'unknown';
  return {
    version,
    channel,
    channels: channels.length ? channels : [channel],
    programDirName: layout.programDirName,
    directory,
    executable: layout.executable,
    cwd: layout.cwd,
    helpKeywordsFile: layout.helpKeywords,
    pairedRuntimeVersion: await readMatchingRuntime(layout.matchingRuntime),
    publishedAt: release?.publishedAt,
    inFeed: !!release,
    installable: !!release?.downloads[opts.platform.feedPlatform],
  };
}

export async function listCachedIdes(
  opts: ResolvedOptions,
  feed: GameMakerReleasesFeed | undefined,
): Promise<CachedIde[]> {
  let entries: string[];
  try {
    entries = await readdir(opts.ideCacheDir);
  } catch {
    return [];
  }
  const ides = await Promise.all(
    entries.map(async (name) => {
      const match = name.match(/^gamemaker-(\d+\.\d+\.\d+\.\d+)$/);
      if (!match) return;
      let version: string;
      try {
        version = normalizeVersion(match[1]);
      } catch {
        return;
      }
      return await readCachedIde(
        opts.platform.path.join(opts.ideCacheDir, name),
        version,
        feed,
        opts,
      );
    }),
  );
  return (ides.filter(Boolean) as CachedIde[]).sort((a, b) =>
    GameMakerVersionString.compareRaw(b.version, a.version),
  );
}

/** List the IDE versions in Stitch's cache, newest first */
export async function listAvailableIdes(
  options?: AnyLauncherOptions,
): Promise<CachedIde[]> {
  const opts = resolveOptions(options);
  return await listCachedIdes(opts, await tryGetReleasesFeed(opts));
}

/** Find an IDE version in Stitch's cache */
export async function findIde(
  ideVersion: string,
  options?: AnyLauncherOptions,
): Promise<CachedIde | undefined> {
  const opts = resolveOptions(options);
  const version = normalizeVersion(ideVersion);
  const directory = opts.platform.path.join(
    opts.ideCacheDir,
    cachedIdeDirName(version),
  );
  if (!(await exists(directory))) return;
  return await readCachedIde(
    directory,
    version,
    await tryGetReleasesFeed(opts),
    opts,
  );
}

/** Like {@link listAvailableIdes}, plus each IDE's size on disk (slow) */
export async function getIdeCacheInfo(
  options?: AnyLauncherOptions,
): Promise<CachedIdeWithSize[]> {
  const ides = await listAvailableIdes(options);
  return await Promise.all(
    ides.map(async (ide) => ({
      ...ide,
      sizeBytes: await dirSize(ide.directory),
    })),
  );
}

/**
 * Delete cached IDE versions, chosen by version or with a predicate.
 * Returns the deleted paths.
 *
 * Versions that can no longer be downloaded are irreplaceable, so this
 * throws a `PRUNE_REQUIRES_CONFIRMATION` error instead of deleting
 * anything if any are selected, unless `includeNotInstallable` is set.
 *
 * Also removes installers that older Stitch versions left in the cache
 * dir, and abandoned partial extractions. Never touches the Downloads dir.
 */
export async function pruneIdeCache(
  filter: string[] | ((ide: CachedIde) => boolean),
  options?: AnyLauncherOptions & { includeNotInstallable?: boolean },
): Promise<string[]> {
  const opts = resolveOptions(options);
  const ides = await listCachedIdes(opts, await tryGetReleasesFeed(opts));
  const versions = Array.isArray(filter) ? filter.map(normalizeVersion) : [];
  const selected = ides.filter((ide) =>
    typeof filter === 'function' ? filter(ide) : versions.includes(ide.version),
  );
  const notInstallable = selected.filter((ide) => !ide.installable);
  if (notInstallable.length && !options?.includeNotInstallable) {
    throw new LauncherError(
      'PRUNE_REQUIRES_CONFIRMATION',
      `These cached GameMaker versions can't be downloaded anymore, so they can't be restored once deleted: ${notInstallable.map((i) => i.version).join(', ')}.`,
      { notInstallable: notInstallable.map((i) => i.version) },
      { fix: 'Pass `includeNotInstallable: true` to delete them anyway.' },
    );
  }

  const removed: string[] = [];
  for (const ide of selected) {
    await rm(ide.directory, { recursive: true, force: true });
    removed.push(ide.directory);
  }
  removed.push(...(await removeCacheLeftovers(opts)));
  return removed;
}

async function removeCacheLeftovers(opts: ResolvedOptions): Promise<string[]> {
  const removed: string[] = [];
  let entries: string[];
  try {
    entries = await readdir(opts.ideCacheDir);
  } catch {
    return removed;
  }
  const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
  for (const name of entries) {
    const full = opts.platform.path.join(opts.ideCacheDir, name);
    // Old launcher versions downloaded installers into the cache dir
    const isOldInstaller = /^gamemaker-[\d.]+\.exe$/i.test(name);
    // Extractions interrupted long enough ago that they can't still be running
    const isAbandoned =
      name.startsWith(tmpDirPrefix) &&
      (await stat(full)
        .then((s) => s.mtimeMs < dayAgo)
        .catch(() => false));
    if (isOldInstaller || isAbandoned) {
      await rm(full, { recursive: true, force: true });
      removed.push(full);
    }
  }
  return removed;
}
