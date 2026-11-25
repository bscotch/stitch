import type { GameMakerReleasesFeed } from '@bscotch/gamemaker-releases';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { after } from 'node:test';
import type { LauncherOptions } from '../lib/options.ts';
import type { OsName, PlatformEnv } from '../lib/platform/types.ts';

export const launcherRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
);
export const samplesDir = path.join(launcherRoot, 'samples');

export async function fixtureFeed(): Promise<GameMakerReleasesFeed> {
  return JSON.parse(
    await readFile(path.join(samplesDir, 'feeds', 'releases.v2.json'), 'utf8'),
  );
}

/** A temp dir that is deleted after the current test file finishes */
export async function tmpDir(prefix = 'stitch-launcher-test-') {
  const dir = await mkdtemp(path.join(os.tmpdir(), prefix));
  after(() => rm(dir, { recursive: true, force: true }));
  return dir;
}

/** Write a file, creating parent dirs */
export async function put(file: string, content: string | object = '') {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(
    file,
    typeof content === 'string' ? content : JSON.stringify(content),
  );
}

const ignore = () => undefined;
export const silentLogger = { info: ignore, warn: ignore, error: ignore };

/**
 * Options rooted in a temp dir, with an injected feed, so nothing touches
 * the real machine. Paths are computed for `os` using native separators
 * for the root (fine for listing/reading tests).
 */
export function testOptions(
  root: string,
  feed: GameMakerReleasesFeed | undefined,
  overrides: Partial<LauncherOptions> = {},
): LauncherOptions {
  const env: PlatformEnv = {
    homedir: path.join(root, 'home'),
    env: {
      PROGRAMDATA: path.join(root, 'ProgramData'),
      APPDATA: path.join(root, 'AppData', 'Roaming'),
      LOCALAPPDATA: path.join(root, 'AppData', 'Local'),
      XDG_DATA_HOME: path.join(root, 'xdg-data'),
      XDG_CONFIG_HOME: path.join(root, 'xdg-config'),
      PATH: '',
    },
    arch: 'x64',
  };
  return {
    stateDir: path.join(root, 'state'),
    ideCacheDir: path.join(root, 'ide-cache'),
    igorCacheDir: path.join(root, 'igor-cache'),
    downloadsDir: path.join(root, 'downloads'),
    feed,
    logger: silentLogger,
    platformEnv: env,
    ...overrides,
  };
}

export function nativeOs(): OsName {
  return process.platform === 'win32'
    ? 'windows'
    : process.platform === 'darwin'
      ? 'mac'
      : 'linux';
}

/**
 * An OS layout whose GameMaker dirs all come from `testOptions`' temp
 * `platformEnv`, so tests that write files never touch the real machine.
 * Not `nativeOs()`: the mac layout hardcodes the system dir to
 * `/Users/Shared`, so on a Mac a test would write into real GameMaker dirs.
 */
export function sandboxedOs(): OsName {
  return process.platform === 'win32' ? 'windows' : 'linux';
}

/**
 * Why a test that creates real files in `os`'s layout must be skipped on
 * this host, or `false` if it can run. The Windows layout joins paths with
 * `path.win32`, which turns a POSIX temp root into a relative,
 * backslash-named path, so it only works on a Windows host.
 */
export function layoutSkipReasonForWindowsExclusiveTests(): string | false {
  return process.platform !== 'win32'
    ? 'Windows layouts need a Windows host'
    : false;
}

/** Relative path to Igor in a runtime dir, for `testOptions`' x64 arch */
export function igorRelativePath(os: OsName): string {
  return os === 'windows'
    ? path.join('bin', 'igor', 'windows', 'x64', 'Igor.exe')
    : path.join('bin', 'igor', os === 'mac' ? 'osx' : 'linux', 'x64', 'Igor');
}

/** Create a fake cached IDE for an OS. Returns its dir. */
export async function fakeCachedIde(
  cacheDir: string,
  version: string,
  options: {
    os: OsName;
    /** e.g. "-Beta" */
    suffix: string;
    matchingRuntime?: string;
  },
) {
  const dir = path.join(cacheDir, `gamemaker-${version}`);
  const runtime = options.matchingRuntime;
  if (options.os === 'windows') {
    await put(path.join(dir, `GameMaker${options.suffix}.exe`), 'exe');
    if (runtime) await put(path.join(dir, 'matching.runtime'), `${runtime} `);
  } else if (options.os === 'mac') {
    const name = options.suffix
      ? `GameMaker ${options.suffix.slice(1).replace(/^LTS(\d+)$/, 'LTS $1')}.app`
      : 'GameMaker.app';
    const macOs = path.join(dir, name, 'Contents', 'MacOS');
    await put(path.join(macOs, 'GameMaker'), 'exe');
    if (runtime)
      await put(path.join(macOs, 'x86_64', 'matching.runtime'), runtime);
  } else {
    const archDir = path.join(dir, `GameMaker${options.suffix}`, 'x86_64');
    await put(path.join(archDir, 'GameMaker'), 'exe');
    if (runtime) await put(path.join(archDir, 'matching.runtime'), runtime);
  }
  return dir;
}
