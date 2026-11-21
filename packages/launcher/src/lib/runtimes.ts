/**
 * @file Find the GameMaker runtimes that IDEs have installed. Stitch never
 * installs runtimes itself: each IDE installs its paired runtime on boot.
 */
import { GameMakerVersionString } from '@bscotch/yy/version';
import { readdir } from 'node:fs/promises';
import { normalizeVersion } from './feed.ts';
import { exists, readJson } from './fsUtil.ts';
import {
  resolveOptions,
  type AnyLauncherOptions,
  type ResolvedOptions,
} from './options.ts';
import { computeGameMakerDirs, knownProgramDirNames } from './paths.ts';

export interface RuntimeModule {
  name: string;
  version?: string;
}

export interface InstalledRuntime {
  version: string;
  directory: string;
  igorPath: string;
  /** The `program_dir_name` of the channel whose runtime cache holds it */
  programDirName: string;
  /** Installed modules (targets), from `receipt.json` */
  modules: RuntimeModule[];
  /** Whether that channel's `runtime.json` lists it as active */
  isActive: boolean;
}

/** Parse a runtime's `receipt.json` into its installed modules */
export function parseRuntimeReceipt(receipt: unknown): RuntimeModule[] {
  if (!receipt || typeof receipt !== 'object') return [];
  return Object.entries(receipt as Record<string, unknown>).map(
    ([key, value]) => {
      const info = (value && typeof value === 'object' ? value : {}) as {
        Name?: unknown;
        Version?: unknown;
      };
      return {
        name: typeof info.Name === 'string' ? info.Name : key,
        version: typeof info.Version === 'string' ? info.Version : undefined,
      };
    },
  );
}

export interface RuntimeConfig {
  active?: string;
  /** Runtime version → its dir (and feed, if the IDE wrote the entry) */
  runtimes: Record<string, { directory: string; feedUrl?: string }>;
}

/**
 * Parse the IDE-owned `runtime.json`:
 * `{"active": "<ver>", "<ver>": "<dir>&<feedUrl>"}`. Entries without
 * `&<feedUrl>` were written by older Stitch versions.
 */
export function parseRuntimeConfig(config: unknown): RuntimeConfig {
  const result: RuntimeConfig = { runtimes: {} };
  if (!config || typeof config !== 'object') return result;
  for (const [key, value] of Object.entries(
    config as Record<string, unknown>,
  )) {
    if (typeof value !== 'string') continue;
    if (key === 'active') {
      result.active = value;
      continue;
    }
    const amp = value.indexOf('&');
    const directory = amp >= 0 ? value.slice(0, amp) : value;
    const feedUrl = amp >= 0 ? value.slice(amp + 1) || undefined : undefined;
    result.runtimes[key] = { directory, feedUrl };
  }
  return result;
}

async function listRuntimesIn(
  programDirName: string,
  opts: ResolvedOptions,
): Promise<InstalledRuntime[]> {
  const p = opts.platform.path;
  const dirs = computeGameMakerDirs(programDirName, opts);
  let entries: string[];
  try {
    entries = await readdir(dirs.runtimes);
  } catch {
    return [];
  }
  const config = parseRuntimeConfig(await readJson(dirs.runtimeConfig));
  const runtimes = await Promise.all(
    entries.map(async (name): Promise<InstalledRuntime | undefined> => {
      const match = name.match(/^runtime-(.+)$/);
      if (!match) return;
      let version: string;
      try {
        version = normalizeVersion(match[1]);
      } catch {
        return;
      }
      const directory = p.join(dirs.runtimes, name);
      // Incomplete dirs exist (e.g. downloads in progress), so only count a
      // runtime as installed if it has both Igor and a receipt.
      const receipt = await readJson(p.join(directory, 'receipt.json'));
      if (!receipt) return;
      let igorPath: string | undefined;
      for (const candidate of opts.platform.igorCandidates(
        directory,
        opts.env.arch,
      )) {
        if (await exists(candidate)) {
          igorPath = candidate;
          break;
        }
      }
      if (!igorPath) return;
      return {
        version,
        directory,
        igorPath,
        programDirName,
        modules: parseRuntimeReceipt(receipt),
        isActive: config.active === version,
      };
    }),
  );
  return runtimes.filter(Boolean) as InstalledRuntime[];
}

/**
 * List the runtimes installed in every channel's runtime cache, newest
 * first. Only complete installs (with Igor and a receipt) are included.
 */
export async function listInstalledRuntimes(
  options?: AnyLauncherOptions,
): Promise<InstalledRuntime[]> {
  const opts = resolveOptions(options);
  const programDirNames = [
    ...new Set([...knownProgramDirNames(), ...Object.keys(opts.gameMakerDirs)]),
  ];
  const all = (
    await Promise.all(programDirNames.map((pdn) => listRuntimesIn(pdn, opts)))
  ).flat();
  // Stable sort keeps the most-stable channel first for duplicate versions
  return all.sort((a, b) =>
    GameMakerVersionString.compareRaw(b.version, a.version),
  );
}

/**
 * Find an installed runtime. If the same version is installed for more
 * than one channel, prefer `programDirName`'s, then the most stable.
 */
export async function findRuntime(
  runtimeVersion: string,
  options?: AnyLauncherOptions & { programDirName?: string },
): Promise<InstalledRuntime | undefined> {
  const version = normalizeVersion(runtimeVersion);
  const matches = (await listInstalledRuntimes(options)).filter(
    (r) => r.version === version,
  );
  return (
    matches.find((r) => r.programDirName === options?.programDirName) ??
    matches[0]
  );
}
