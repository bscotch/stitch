import { Pathy } from '@bscotch/pathy';
import { ok } from 'assert';
import { default as axios } from 'axios';
import { exec } from 'child_process';
import { createWriteStream } from 'fs';
import os from 'os';
import {
  GameMakerDefaultMacros,
  GameMakerInstalledVersion,
  GameMakerLogOptions,
} from './GameMakerLauncher.types.js';
import { StitchSupportedBuilder } from './GameMakerRuntime.types.js';

import { assert, Debugger, Trace, useTracer } from '@bscotch/utility/browser';
import { z } from 'zod';

const libName = '@bscotch/stitch-launcher';

export const debug: Debugger = useTracer(libName);

export const trace = Trace(libName);

export type RuntimeFeedsFile = z.infer<typeof runtimeFeedsFileSchema>;
export const runtimeFeedsFileSchema = z.array(
  z.object({
    Key: z.string().describe('The name of the feed'),
    Value: z.string().describe('The URL of the feed'),
  }),
);

export function createStaticTracer(className: string, methodName: string) {
  return useTracer(`${libName}:${className}:${methodName}`);
}

export const bootstrapRuntimeVersion = '2022.300.0.476';

export const stitchConfigDir = new Pathy(`${os.homedir()}/.stitch`);

export const currentOs =
  os.platform() === 'win32'
    ? 'windows'
    : os.platform() === 'darwin'
      ? 'osx'
      : os.platform() === 'linux'
        ? 'linux'
        : undefined;

export const currentArchitecture = os.arch();

/**
 * Maps the current OS to the corresponding GameMaker CLI target platform.
 * This provides a cleaner mapping than using currentOs directly.
 */
export const defaultTargetPlatform: StitchSupportedBuilder =
  os.platform() === 'win32'
    ? 'windows'
    : os.platform() === 'darwin'
      ? 'mac'
      : os.platform() === 'linux'
        ? 'linux'
        : 'windows'; // fallback

export function artifactExtensionForPlatform(platform: StitchSupportedBuilder) {
  const extensions: {
    [P in StitchSupportedBuilder]: string;
  } = {
    android: 'aab',
    ios: 'iap',
    linux: 'zip',
    mac: 'zip',
    switch: 'nsp',
    windows: 'zip',
    winuwp: 'appxbundle',
    xboxone: 'xboxone-pkg',
    xboxseriesxs: 'xboxseriesxs-pkg',
  };
  const extension = extensions[platform];
  ok(extension, `Unsupported platform, no extension defined: ${platform}`);
  return extension;
}

/**
 * Given a .yyp filepath, or a directory that should
 * contain one, return the containing directory only.
 */
export function projectFolder(projectPath: string | Pathy): Pathy {
  const path = Pathy.asInstance(projectPath);
  if (path.basename.endsWith('.yyp')) {
    return path.up();
  }
  return path;
}

export async function projectLogDirectory(
  project?: string | Pathy,
  options?: GameMakerLogOptions,
) {
  const logDir = new Pathy(
    options?.logDir ||
      (project && projectFolder(project).join('logs')) ||
      stitchConfigDir.join('logs'),
  );
  await logDir.ensureDirectory();
  return logDir;
}

/**
 * Sorts *in place*, descending (most recent date first).
 */
export function sortByDateField<
  F extends string,
  T extends Record<F, Date | undefined>,
>(entries: T[], dateField: F): T[] {
  // Sort the combined feed by date, ascending
  entries.sort((a, b) => {
    if (a[dateField] === undefined && b[dateField] === undefined) {
      return 0;
    }
    if (a[dateField] === undefined) {
      return 1;
    }
    if (b[dateField] === undefined) {
      return -1;
    }
    return b[dateField]!.getTime() - a[dateField]!.getTime();
  });
  return entries;
}

export async function downloadIfCacheExpired<T>(
  url: string,
  filePath: Pathy<T>,
  maxAgeInSeconds: number,
) {
  if (await cachedFileIsExpired(filePath, maxAgeInSeconds)) {
    let data!: T;
    try {
      data = (await axios(url)).data as T;
      await filePath.write(data);
    } catch (err) {
      const fileExists = filePath.existsSync();
      if (fileExists) {
        console.warn('Download error for', url);
        // Fail gracefully, since the caller can fall back on the cached file.
        return;
      }
      throw err;
    }
  }
}

export async function cachedFileIsExpired(
  filePath: Pathy,
  maxAgeInSeconds: number,
): Promise<boolean> {
  const isOutdated =
    !(await filePath.exists()) ||
    (await filePath.stat()).mtimeMs < Date.now() - 1000 * maxAgeInSeconds;
  return !!isOutdated;
}

/**
 * Given a version string, ensure it has the correct
 * format for use by this package (4 dot-separated
 * numbers, without a leading 'v').
 */
export function cleanVersionString(version: string): string {
  version = version.replace(/^v/, '');
  ok(
    version.match(/^\d+\.\d+\.\d+\.\d+$/),
    `Invalid version string: ${version}`,
  );
  return version;
}

export async function download(
  url: string,
  to: Pathy,
  options?: { force: boolean },
) {
  if ((await to.exists()) && !options?.force) {
    console.log(
      `Download target path already exists, skipping download: "${to}"`,
    );
    return;
  }
  await to.up().ensureDirectory();
  console.log(`Downloading ${url} to ${to.absolute}`);
  const response = await axios({
    method: 'get',
    url,
    responseType: 'stream',
  });
  const writeStream = createWriteStream(to.absolute);
  response.data.pipe(writeStream);

  return new Promise((resolve) => {
    writeStream.on('finish', () => {
      writeStream.close();
      resolve(undefined);
    });
  });
}

// Make async so we don't block any threads
export async function runIdeInstaller(idePath: Pathy) {
  console.log('Running installer', idePath.basename, '...');
  
  if (process.platform === 'win32') {
    const command = `start /wait "" "${idePath.absolute}" /S`;
    debug(`Running command: ${command}`);
    const installer = exec(command);
    return await new Promise((resolve, reject) => {
      installer.on('error', reject);
      installer.on('exit', resolve);
    });
  } else if (process.platform === 'darwin') {
    // For now, display a helpful message to the user
    console.log('Mac GameMaker installation not yet supported.');
    // Skip automatic installation on macOS for now
    return Promise.resolve();
  } else {
    throw new Error('IDE installation only supported on Windows and macOS');
  }
}

/**
 * Find the paths to all installed runtime versions.
 * Uses discovery plus some basic heuristics and smoke
 * tests to return paths that are likely to correspond
 * with valid runtime installations.
 *
 * Windows: `$PROGRAMDATA/GameMakerStudio2(-(Beta|LTS))?/Cache/runtimes/*`
 * macOS: Runtime is integrated within the GameMaker application
 */
export async function listInstalledRuntimes(): Promise<
  Omit<GameMakerInstalledVersion, 'channel' | 'publishedAt' | 'feedUrl'>[]
> {
  const runtimes: Omit<
    GameMakerInstalledVersion,
    'channel' | 'publishedAt' | 'feedUrl'
  >[] = [];

  if (process.platform === 'win32') {
    // Existing Windows runtime discovery logic
    const runtimeDirs = await listGameMakerRuntimeDirs();
    for (const runtimeDir of runtimeDirs) {
      const version = runtimeDir.basename.replace(/^runtime-/, '');
      if (!version.match(/^\d+\.\d+\.\d+\.\d+$/)) {
        console.warn(
          `Skipping invalid runtime version string ${version} parsed from ${runtimeDir.absolute}`,
        );
        continue;
      }
      if (await runtimeDir.isEmptyDirectory()) {
        await runtimeDir.delete({ recursive: true });
        continue;
      }

      const executablePaths = [
        runtimeDir.join('bin/Igor.exe'),
        runtimeDir.join('bin/igor/windows/x64/Igor.exe'),
      ];
      let executablePath: Pathy | undefined;
      for (const path of executablePaths) {
        if (await path.exists()) {
          executablePath = path;
          break;
        }
      }
      if (!executablePath) {
        continue;
      }
      runtimes.push({
        version,
        directory: runtimeDir,
        executablePath,
      });
    }
  } else if (process.platform === 'darwin') {
    // macOS: Search for runtimes in /Users/Shared/GameMakerStudio2/Cache/runtimes/
    const sharedRuntimesDir = new Pathy('/Users/Shared/GameMakerStudio2/Cache/runtimes');
    if (await sharedRuntimesDir.exists()) {
      const runtimeDirs = (await sharedRuntimesDir.listChildren()).filter((p) =>
        p.basename.match(/^runtime-/)
      );
      
      for (const runtimeDir of runtimeDirs) {
        const version = runtimeDir.basename.replace(/^runtime-/, '');
        if (!version.match(/^\d+\.\d+\.\d+\.\d+$/)) {
          console.warn(
            `Skipping invalid runtime version string ${version} parsed from ${runtimeDir.absolute}`,
          );
          continue;
        }
        
        // Look for Igor executable on macOS
        const executablePaths = [
          runtimeDir.join('bin/igor/osx/arm64/Igor'),
          runtimeDir.join('bin/igor/osx/x64/Igor'),
          runtimeDir.join('bin/Igor')
        ];
        
        let executablePath: Pathy | undefined;
        for (const path of executablePaths) {
          if (await path.exists()) {
            executablePath = path;
            break;
          }
        }
        
        if (executablePath) {
          runtimes.push({
            version,
            directory: runtimeDir,
            executablePath,
          });
        }
      }
    }
  }
  
  return runtimes;
}

async function listGameMakerRuntimeDirs(): Promise<Pathy[]> {
  const runtimesDirs: Pathy[] = [];
  
  if (process.platform === 'win32') {
    // Existing Windows runtime discovery logic
    const channelFolders = await listGameMakerDataDirs();
    for (const channelFolder of channelFolders) {
      const cacheDir = channelFolder.join('Cache/runtimes');
      if (!(await cacheDir.exists())) {
        continue;
      }
      runtimesDirs.push(
        ...(await cacheDir.listChildren()).filter((p) =>
          p.basename.match(/^runtime-/),
        ),
      );
    }
  } else if (process.platform === 'darwin') {
    // macOS: Search in /Users/Shared/GameMakerStudio2/Cache/runtimes
    const sharedRuntimesDir = new Pathy('/Users/Shared/GameMakerStudio2/Cache/runtimes');
    if (await sharedRuntimesDir.exists()) {
      runtimesDirs.push(
        ...(await sharedRuntimesDir.listChildren()).filter((p) =>
          p.basename.match(/^runtime-/),
        ),
      );
    }
  }
  
  return runtimesDirs;
}

/**
 * Set the active runtime by updating GameMaker's
 * program data files. This sets the active runtime
 * for *all* installed IDEs!
 */
export async function setActiveRuntime(runtime: {
  version: string;
  directory: Pathy;
}) {
  for (const dataDir of await listGameMakerDataDirs()) {
    const runtimeConfigFile = dataDir.join('runtime.json');
    const currentConfig: Record<string, string> =
      (await runtimeConfigFile.exists()) ? await runtimeConfigFile.read() : {};
    currentConfig.active = runtime.version;
    currentConfig[runtime.version] = runtime.directory.toString({
      format: 'win32',
    });
    await runtimeConfigFile.write(JSON.stringify(currentConfig));
  }
}

/**
 * Note that these paths are not populated by
 * default, so they may point to non-existent files.
 */
export async function listDefaultMacrosPaths(): Promise<
  Pathy<GameMakerDefaultMacros>[]
> {
  const paths = await listGameMakerDataDirs();
  return paths.map((p) => p.join('default_macros.json'));
}

export async function listRuntimeFeedsConfigPaths(): Promise<
  Pathy<RuntimeFeedsFile>[]
> {
  const paths = await listGameMakerDataDirs();
  return paths.map((p) =>
    p.join('runtime_feeds.json').withValidator(runtimeFeedsFileSchema),
  );
}

/**
 * Find GameMaker's program data caches. These store
 * installed Runtimes, current IDE configuration info,
 * and other data.
 *
 * Windows: `$PROGRAMDATA/GameMakerStudio2(-(Beta|LTS))?/`
 * macOS: `~/Library/Application Support/GameMaker/`
 */
export async function listGameMakerDataDirs(): Promise<Pathy[]> {
  const dataDirs: Pathy[] = [];
  
  if (process.platform === 'win32') {
    // Windows: Currently the caches are stored in
    // $PROGRAMDATA/GameMakerStudio2(-(Beta|LTS))?/Cache
    // With the rename, this could change to just GameMaker,
    // so we'll use some simple discovery heuristics.
    const potentialDataDirs = (
      await new Pathy(process.env.PROGRAMDATA).listChildren()
    ).filter((p) => p.basename.match(/^GameMaker/));
    for (const potentialDataDir of potentialDataDirs) {
      const cacheDir = potentialDataDir.join('Cache/runtimes');
      if (await cacheDir.exists()) {
        dataDirs.push(potentialDataDir);
      }
    }
  } else if (process.platform === 'darwin') {
    // macOS: GameMaker uses multiple locations
    
    // 1. User data in ~/Library/Application Support/GameMakerStudio2
    const userDataDir = new Pathy(`${os.homedir()}/Library/Application Support/GameMakerStudio2`);
    if (await userDataDir.exists()) {
      dataDirs.push(userDataDir);
    }
    
    // 2. Shared runtimes in /Users/Shared/GameMakerStudio2
    const sharedDir = new Pathy('/Users/Shared/GameMakerStudio2');
    if (await sharedDir.exists()) {
      const cacheDir = sharedDir.join('Cache/runtimes');
      if (await cacheDir.exists()) {
        dataDirs.push(sharedDir);
      }
    }
  }
  
  return dataDirs;
}

export async function listInstalledIdes(
  parentDir?: string | Pathy,
) {
  if (process.platform === 'win32') {
    parentDir = parentDir || process.env.PROGRAMFILES!;
    assert(parentDir, 'No program files directory provided');

    const ideExecutables = await new Pathy(parentDir).listChildrenRecursively({
      maxDepth: 1,
      includePatterns: [/^GameMaker(Studio2?)?(-(Beta|LTS))?\.exe$/],
    });
    return ideExecutables;
  } else if (process.platform === 'darwin') {
    parentDir = parentDir || '/Applications';
    const ideApps = await new Pathy(parentDir).listChildrenRecursively({
      maxDepth: 2,
      includePatterns: [/^GameMaker(Studio2?)?(-(Beta|LTS))?\.app$/],
    });
    // On macOS, executables are inside the .app bundle
    const ideExecutables: Pathy[] = [];
    for (const app of ideApps) {
      const executable = app.join('Contents/MacOS/GameMaker');
      if (await executable.exists()) {
        ideExecutables.push(executable);
      }
    }
    return ideExecutables;
  }
  return [];
}
