import { dev } from '$app/environment';
import { env } from '$env/dynamic/public';

import type { GameMakerChannel } from '../api.js';

export const stitchVersion = await (window.electron?.version() || '0.0.0');

export const serverPort = dev ? env.PUBLIC_PORT : location.port;
export const serverBaseUrl = `http://localhost:${serverPort}`;

export const gameMakerChannels: GameMakerChannel[] = ['lts', 'stable', 'beta'];
export const gameMakerFeedTypes = ['ide', 'runtime'] as const;

const ideReleaseNotesBaseUrl = 'https://gms.yoyogames.com/ReleaseNotes';

const runtimeReleaseNotesBaseUrl =
  'https://gms.yoyogames.com/release-notes-runtime';

function ideReleaseNotesUrls(): {
  [Channel in GameMakerChannel]: string;
} {
  return {
    lts: `${ideReleaseNotesBaseUrl}-LTS.html`,
    stable: `${ideReleaseNotesBaseUrl}.html`,
    beta: `${ideReleaseNotesBaseUrl}-NuBeta.html`,
    unstable: `${ideReleaseNotesBaseUrl}-NuBeta-I.html`,
  };
}

function runtimeReleaseNotesUrls(): {
  [Channel in GameMakerChannel]: string;
} {
  return {
    lts: `${runtimeReleaseNotesBaseUrl}-LTS.html`,
    stable: `${runtimeReleaseNotesBaseUrl}.html`,
    beta: `${runtimeReleaseNotesBaseUrl}-NuBeta.html`,
    unstable: `${runtimeReleaseNotesBaseUrl}-NuBeta-I.html`,
  };
}

function ideFeedUrls(): {
  [Channel in GameMakerChannel]: string;
} {
  const prefix = `https://gms.yoyogames.com/update-win`;
  return {
    lts: `${prefix}-LTS.rss`,
    stable: `${prefix}.rss`,
    beta: `${prefix}-NuBeta.rss`,
    unstable: `${prefix}-NuBeta-I.rss`,
  };
}

function runtimeFeedUrls(): {
  [Channel in GameMakerChannel]: string;
} {
  const prefix = `https://gms.yoyogames.com/Zeus-Runtime`;
  return {
    lts: `${prefix}-LTS.rss`,
    stable: `${prefix}.rss`,
    beta: `${prefix}-NuBeta.rss`,
    unstable: `${prefix}-NuBeta-I.rss`,
  };
}

export const gameMakerFeeds = {
  ide: ideFeedUrls(),
  runtime: runtimeFeedUrls(),
} as const;

export const gameMakerReleaseNotes = {
  ide: ideReleaseNotesUrls(),
  runtime: runtimeReleaseNotesUrls(),
} as const;

export function releaseNotesUrl(
  type: 'ide' | 'runtime',
  feed: GameMakerChannel,
): string {
  return gameMakerReleaseNotes[type][feed];
}
