/**
 * @file Pure computation of GameMaker's directories.
 *
 * Each channel's IDE has a `program_dir_name` compiled into it
 * (`GameMakerStudio2<suffix>`), and derives all of its working dirs from
 * that plus .NET special folders. So no discovery is needed: see NOTES.md.
 */
import {
  channels as knownChannels,
  type ChannelInfo,
} from '@bscotch/gamemaker-releases';
import type { ResolvedOptions } from './options.ts';

type ChannelLike = Pick<ChannelInfo, 'name' | 'userDirSuffix'>;

const defaultChannels = knownChannels as readonly ChannelLike[];

export function programDirNameForSuffix(suffix: string) {
  return `GameMakerStudio2${suffix}`;
}

/** The `program_dir_name` used by IDEs of a channel */
export function programDirNameForChannel(
  channel: string,
  channels: readonly ChannelLike[] = defaultChannels,
): string | undefined {
  const info = channels.find((c) => c.name === channel);
  return info ? programDirNameForSuffix(info.userDirSuffix) : undefined;
}

/**
 * The most stable channel whose IDEs use a `program_dir_name`
 * (e.g. Beta and Unstable share `GameMakerStudio2-Beta`, giving "beta").
 */
export function channelForProgramDirName(
  programDirName: string,
  channels: readonly ChannelLike[] = defaultChannels,
): string | undefined {
  return channels.find(
    (c) => programDirNameForSuffix(c.userDirSuffix) === programDirName,
  )?.name;
}

/** All channels that share a `program_dir_name`, most stable first */
export function channelsForProgramDirName(
  programDirName: string,
  channels: readonly ChannelLike[] = defaultChannels,
): string[] {
  return channels
    .filter((c) => programDirNameForSuffix(c.userDirSuffix) === programDirName)
    .map((c) => c.name);
}

/** Every known `program_dir_name`, most stable channel first */
export function knownProgramDirNames(
  channels: readonly ChannelLike[] = defaultChannels,
): string[] {
  return [
    ...new Set(channels.map((c) => programDirNameForSuffix(c.userDirSuffix))),
  ];
}

export interface GameMakerDirs {
  programDirName: string;
  /** `${CommonApplicationData}/<pdn>`: runtimes, IDE-wide config, logs */
  system: string;
  /** `${ApplicationData}/<pdn>`: logins and per-user preferences */
  user: string;
  /** Installed runtimes, as `runtime-<version>` dirs */
  runtimes: string;
  /** The IDE's log file */
  ideLog: string;
  /** Overrides of the IDE's macros (only exists if someone created it) */
  defaultMacros: string;
  /** The IDE-owned list of installed runtimes, and the active one */
  runtimeConfig: string;
  /** The IDE-owned list of runtime feeds */
  runtimeFeeds: string;
  /** The current login (contains tokens: never log or copy it) */
  userInfo: string;
}

export function computeGameMakerDirs(
  programDirName: string,
  options: Pick<ResolvedOptions, 'platform' | 'env' | 'gameMakerDirs'>,
): GameMakerDirs {
  const { platform, env } = options;
  const p = platform.path;
  const folders = platform.specialFolders(env);
  const overrides = options.gameMakerDirs[programDirName] ?? {};
  const system =
    overrides.system ?? p.join(folders.commonApplicationData, programDirName);
  const user =
    overrides.user ?? p.join(folders.applicationData, programDirName);
  return {
    programDirName,
    system,
    user,
    runtimes: p.join(system, 'Cache', 'runtimes'),
    ideLog: p.join(system, 'ui.log'),
    defaultMacros: p.join(system, 'default_macros.json'),
    runtimeConfig: p.join(system, 'runtime.json'),
    runtimeFeeds: p.join(system, 'runtime_feeds.json'),
    userInfo: p.join(user, 'um.json'),
  };
}

/** The dir name of a cached IDE version */
export function cachedIdeDirName(version: string) {
  return `gamemaker-${version}`;
}
