/**
 * @file Installing an IDE version into Stitch's cache: download the official
 * installer to the Downloads dir, then extract it (with 7-Zip on Windows and
 * Linux, and `pkgutil` on macOS). Stitch never runs installers.
 */
import { GameMakerVersionString } from '@bscotch/yy/version';
import { createWriteStream } from 'node:fs';
import { mkdir, rename, rm, stat } from 'node:fs/promises';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import type { ReadableStream as WebReadableStream } from 'node:stream/web';
import { isLauncherError, LauncherError } from './errors.ts';
import { findRelease, getReleasesFeed, normalizeVersion } from './feed.ts';
import { exists } from './fsUtil.ts';
import {
  listCachedIdes,
  readCachedIde,
  tmpDirPrefix,
  type CachedIde,
} from './ideCache.ts';
import {
  resolveOptions,
  type AnyLauncherOptions,
  type ResolvedOptions,
} from './options.ts';
import { cachedIdeDirName, computeGameMakerDirs } from './paths.ts';
import { findSevenZip, type SevenZipInfo } from './sevenZip.ts';
import { restoreUpdatePrompts } from './updatePrompt.ts';

export type InstallProgress =
  | { stage: 'checking' }
  | { stage: 'downloading'; receivedBytes: number; totalBytes?: number }
  | { stage: 'verifying' }
  | { stage: 'extracting' }
  | { stage: 'done'; ide: CachedIde };

export interface InstallIdeOptions {
  /** Re-download and re-extract even if the version is already cached */
  force?: boolean;
  onProgress?: (progress: InstallProgress) => void;
}

const inFlight = new Map<string, Promise<CachedIde>>();

/**
 * Install an IDE version into Stitch's cache, unless it's already there.
 * The IDE installs its own runtime the first time it boots.
 *
 * Fails fast (before downloading) if this OS needs 7-Zip and no suitable
 * one is available. On
 * Windows, fails with `VC_RUNTIME_MISSING` if the VC++ runtime the IDE
 * needs is missing; the error points at the downloaded installer, which
 * installs it when run as a normal install.
 */
export async function installIde(
  ideVersion: string,
  options?: AnyLauncherOptions & InstallIdeOptions,
): Promise<CachedIde> {
  const opts = resolveOptions(options);
  const version = normalizeVersion(ideVersion);
  const key = `${opts.ideCacheDir}|${version}`;
  const existing = inFlight.get(key);
  if (existing) return await existing;
  const promise = install(version, opts, options ?? {}).finally(() =>
    inFlight.delete(key),
  );
  inFlight.set(key, promise);
  return await promise;
}

async function install(
  version: string,
  opts: ResolvedOptions,
  { force, onProgress }: InstallIdeOptions,
): Promise<CachedIde> {
  const p = opts.platform.path;
  await restoreUpdatePrompts(opts).catch((err) =>
    opts.logger.warn('Could not restore GameMaker update settings', err),
  );
  onProgress?.({ stage: 'checking' });
  const finalDir = p.join(opts.ideCacheDir, cachedIdeDirName(version));
  if (!force) {
    const cached = await findCached(finalDir, version, opts);
    if (cached) return cached;
  }

  const sevenZip = opts.platform.sevenZip
    ? await findSevenZip(opts)
    : undefined;
  const feed = await getReleasesFeed(opts);
  const release = findRelease(feed, version);
  const url = release?.downloads[opts.platform.feedPlatform];
  if (!url) {
    throw await notInstallableError(version, release?.channels[0], opts);
  }

  const installer = await downloadInstaller(url, opts, { force, onProgress });

  if (opts.platform.checkVcRuntime && !(await opts.platform.checkVcRuntime())) {
    throw new LauncherError(
      'VC_RUNTIME_MISSING',
      'GameMaker needs the Microsoft Visual C++ runtime, which is not installed.',
      { installerPath: installer },
      {
        fix: `Run the official GameMaker installer once as a normal install (it installs the VC++ runtime): "${installer}". Stitch's cached copy is not affected by that install.`,
      },
    );
  }

  onProgress?.({ stage: 'verifying' });
  await opts.platform.verifyInstaller(installer);

  onProgress?.({ stage: 'extracting' });
  const ide = await extract(installer, version, sevenZip, finalDir, opts);

  const { system } = computeGameMakerDirs(ide.programDirName, opts);
  const shared = await opts.platform.ensureSystemDir(system);
  if (shared.hint) opts.logger.warn(shared.hint);

  onProgress?.({ stage: 'done', ide });
  return ide;
}

async function findCached(dir: string, version: string, opts: ResolvedOptions) {
  if (!(await exists(dir))) return;
  const feed = await getReleasesFeed(opts).catch(() => undefined);
  return await readCachedIde(dir, version, feed, opts);
}

async function extract(
  installer: string,
  version: string,
  sevenZip: SevenZipInfo | undefined,
  finalDir: string,
  opts: ResolvedOptions,
): Promise<CachedIde> {
  const p = opts.platform.path;
  // Extract to a temp dir and rename, so a partial extraction never looks
  // like an installed IDE.
  const tmpDir = p.join(
    opts.ideCacheDir,
    `${tmpDirPrefix}${version}-${Math.random().toString(36).slice(2, 8)}`,
  );
  await mkdir(tmpDir, { recursive: true });
  try {
    await opts.platform.extractInstaller(installer, tmpDir, sevenZip?.path);
    const layout = await opts.platform.resolveIdeLayout(tmpDir, opts.env.arch);
    if (
      !layout ||
      !(await exists(layout.executable)) ||
      !(await exists(layout.matchingRuntime))
    ) {
      throw new Error(
        'The extracted files do not include the IDE executable and its matching.runtime file.',
      );
    }
    await rm(finalDir, { recursive: true, force: true });
    await rename(tmpDir, finalDir);
  } catch (err) {
    await rm(tmpDir, { recursive: true, force: true }).catch(() => undefined);
    throw new LauncherError(
      'EXTRACT_FAILED',
      `Could not extract the GameMaker installer "${installer}": ${(err as Error).message}`,
      { installerPath: installer },
      { cause: err },
    );
  }
  const feed = await getReleasesFeed(opts).catch(() => undefined);
  const ide = await readCachedIde(finalDir, version, feed, opts);
  if (!ide) {
    throw new LauncherError(
      'EXTRACT_FAILED',
      `Extracted GameMaker v${version}, but could not find it afterwards in "${finalDir}".`,
      { installerPath: installer },
    );
  }
  return ide;
}

async function notInstallableError(
  version: string,
  channel: string | undefined,
  opts: ResolvedOptions,
) {
  const feed = await getReleasesFeed(opts).catch(() => undefined);
  const cachedIdes = await listCachedIdes(opts, feed);
  const sameChannel = (channels: string[]) =>
    !channel || channels.includes(channel);
  const cached = cachedIdes
    .filter((i) => sameChannel(i.channels))
    .map((i) => i.version);
  const installable = (feed?.releases ?? [])
    .filter(
      (r) => r.downloads[opts.platform.feedPlatform] && sameChannel(r.channels),
    )
    .map((r) => r.version)
    .sort((a, b) => GameMakerVersionString.compareRaw(b, a));
  const os = opts.platform.os;
  return new LauncherError(
    'IDE_NOT_INSTALLABLE',
    channel
      ? `GameMaker v${version} has no download for ${os}.`
      : `GameMaker v${version} can't be downloaded anymore (it's not in the releases feed).`,
    { ideVersion: version, channel, cached, installable },
    {
      fix: `Update the project to a GameMaker version that's still available${channel ? ` on the ${channel} channel` : ''}${installable[0] ? ` (latest: ${installable[0]})` : ''}${cached.length ? `, or use a cached version (${cached.slice(0, 5).join(', ')})` : ''}.`,
    },
  );
}

/** Installer file name from its URL */
function installerFileName(url: string) {
  return decodeURIComponent(
    new URL(url).pathname.split('/').pop() || 'installer',
  );
}

/**
 * The path to an IDE version's already-downloaded installer, if it's in
 * the Downloads dir. UIs can use this to offer running it.
 */
export async function getInstallerPath(
  ideVersion: string,
  options?: AnyLauncherOptions,
): Promise<string | undefined> {
  const opts = resolveOptions(options);
  const release = findRelease(
    await getReleasesFeed(opts),
    normalizeVersion(ideVersion),
  );
  const url = release?.downloads[opts.platform.feedPlatform];
  if (!url) return;
  const file = opts.platform.path.join(
    await opts.downloadsDir(),
    installerFileName(url),
  );
  return (await exists(file)) ? file : undefined;
}

async function remoteSize(url: string): Promise<number | undefined> {
  try {
    const res = await fetch(url, { method: 'HEAD' });
    const length = Number(res.headers.get('content-length'));
    return res.ok && length > 0 ? length : undefined;
  } catch {
    return;
  }
}

/**
 * Download an installer into the Downloads dir, under its original name.
 * An existing file is reused if its size matches the server's (or if the
 * server can't be reached).
 */
async function downloadInstaller(
  url: string,
  opts: ResolvedOptions,
  { force, onProgress }: InstallIdeOptions,
): Promise<string> {
  const p = opts.platform.path;
  const downloads = await opts.downloadsDir();
  const target = p.join(downloads, installerFileName(url));
  if (!force && (await exists(target))) {
    const [local, remote] = await Promise.all([stat(target), remoteSize(url)]);
    if (remote === undefined || remote === local.size) {
      opts.logger.info(`Using the already-downloaded installer "${target}"`);
      return target;
    }
    opts.logger.warn(
      `"${target}" is ${local.size} bytes but should be ${remote}; downloading it again.`,
    );
  }

  await mkdir(downloads, { recursive: true });
  const partial = `${target}.partial`;
  opts.logger.info(`Downloading ${url} to "${target}"`);
  try {
    const res = await fetch(url);
    if (!res.ok || !res.body) {
      throw new Error(`HTTP ${res.status} ${res.statusText}`);
    }
    const totalBytes = Number(res.headers.get('content-length')) || undefined;
    let receivedBytes = 0;
    let lastReport = 0;
    const body = Readable.fromWeb(res.body as WebReadableStream<Uint8Array>);
    body.on('data', (chunk: Buffer) => {
      receivedBytes += chunk.length;
      if (Date.now() - lastReport > 250) {
        lastReport = Date.now();
        onProgress?.({ stage: 'downloading', receivedBytes, totalBytes });
      }
    });
    await pipeline(body, createWriteStream(partial));
    if (totalBytes && receivedBytes !== totalBytes) {
      throw new Error(`Received ${receivedBytes} of ${totalBytes} bytes`);
    }
    onProgress?.({ stage: 'downloading', receivedBytes, totalBytes });
    await rename(partial, target);
  } catch (err) {
    await rm(partial, { force: true }).catch(() => undefined);
    throw new LauncherError(
      'DOWNLOAD_FAILED',
      `Could not download the GameMaker installer from ${url}: ${(err as Error).message}`,
      { url },
      { cause: err },
    );
  }
  return target;
}

export interface Prerequisites {
  /**
   * The 7-Zip that will be used, or the error explaining what's wrong.
   * `undefined` on an OS that doesn't need 7-Zip (macOS).
   */
  sevenZip?:
    SevenZipInfo | LauncherError<'SEVEN_ZIP_MISSING' | 'SEVEN_ZIP_INCAPABLE'>;
  /** Windows only: whether the VC++ runtime is installed */
  vcRuntime?: boolean;
}

/** Check what `installIde` needs, so UIs can report problems up front */
export async function checkPrerequisites(
  options?: AnyLauncherOptions,
): Promise<Prerequisites> {
  const opts = resolveOptions(options);
  const [sevenZip, vcRuntime] = await Promise.all([
    opts.platform.sevenZip
      ? findSevenZip(opts).catch((err) => {
          if (
            isLauncherError(err, 'SEVEN_ZIP_MISSING') ||
            isLauncherError(err, 'SEVEN_ZIP_INCAPABLE')
          ) {
            return err;
          }
          throw err;
        })
      : undefined,
    opts.platform.checkVcRuntime?.(),
  ]);
  return { sevenZip, vcRuntime };
}
