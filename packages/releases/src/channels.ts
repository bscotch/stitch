/**
 * @file The GameMaker release channels that make up the unified feed,
 * described with metadata so that downstream logic and UIs can decide how
 * to handle each one without hardcoding channel names.
 *
 * To add a new channel (e.g. a future LTS), add an entry here. Order
 * matters: channels are listed from most to least stable, and that order
 * is used whenever we need to pick a "preferred" channel for a version
 * that appears in multiple channels.
 */
import type { ChannelInfo } from './schemas.ts';

const host = 'https://gms.yoyogames.com';

/** URL of one of GameMaker's RSS feeds */
function feed(name: string) {
  return `${host}/${name}.rss`;
}

export const channels = [
  {
    name: 'lts2026',
    kind: 'lts',
    status: 'active',
    title: 'LTS 2026',
    description:
      'The 2026 Long-Term Support series. GameMaker recommends this channel for most users. Only receives critical fixes.',
    ideFeeds: {
      windows: feed('update-win-LTS2026'),
      mac: feed('update-mac-LTS2026'),
      linux: feed('update-linux-LTS2026'),
    },
    runtimeFeeds: [feed('Zeus-Runtime-LTS2026')],
    userDirSuffix: '-LTS2026',
  },
  {
    name: 'lts2022',
    kind: 'lts',
    status: 'frozen',
    title: 'LTS 2022',
    description:
      'The 2022 Long-Term Support series. No longer updated, superseded by LTS 2026.',
    ideFeeds: {
      windows: feed('update-win-LTS'),
      mac: feed('update-mac-LTS'),
    },
    runtimeFeeds: [feed('Zeus-Runtime-LTS'), feed('Zeus-Runtime-LTS-I')],
    userDirSuffix: '-LTS',
  },
  {
    name: 'monthly',
    kind: 'monthly',
    status: 'frozen',
    title: 'Monthly',
    description:
      'The old "Monthly" (stable) releases, from 2023.8 through 2024.14.4. No longer updated, superseded by LTS 2026.',
    ideFeeds: {
      windows: feed('update-win'),
      mac: feed('update-mac'),
    },
    runtimeFeeds: [feed('Zeus-Runtime')],
    userDirSuffix: '',
    minVersion: '2023.8.0.0',
  },
  {
    name: 'beta',
    kind: 'beta',
    status: 'active',
    title: 'Beta',
    description:
      'The most up-to-date features, released frequently. Versions use Beta numbering, where the minor version is 100x the stable version it will become (e.g. 2026.100 became LTS 2026.1).',
    ideFeeds: {
      windows: feed('update-win-NuBeta'),
      mac: feed('update-mac-NuBeta'),
      linux: feed('update-linux-NuBeta'),
    },
    runtimeFeeds: [feed('Zeus-Runtime-NuBeta')],
    userDirSuffix: '-Beta',
  },
  {
    name: 'unstable',
    kind: 'unstable',
    status: 'active',
    title: 'Unstable',
    description:
      'Interim builds between Beta releases. Includes every Beta release plus many builds that are never promoted. Not officially documented.',
    ideFeeds: {
      windows: feed('update-win-NuBeta-I'),
      mac: feed('update-mac-NuBeta-I'),
      linux: feed('update-linux-NuBeta-I'),
    },
    runtimeFeeds: [feed('Zeus-Runtime-NuBeta-I')],
    userDirSuffix: '-Beta',
  },
] as const satisfies ChannelInfo[];
Object.freeze(channels);

/** A name of one of the channels currently known to this package. */
export type KnownChannelName = (typeof channels)[number]['name'];

/** Channel names, from most to least stable. */
export const channelNames = channels.map((c) => c.name) as KnownChannelName[];

export function getChannel(name: string): ChannelInfo | undefined {
  return channels.find((c) => c.name === name);
}
