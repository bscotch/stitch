import type { Channel } from './schemas.ts';

/**
 * The Windows IDE RSS feeds that were used to build the *legacy* feed.
 * @deprecated Use the channel metadata in `channels.ts` instead.
 */
export function ideFeedUrls() {
  const prefix = `https://gms.yoyogames.com/update-win`;
  return {
    lts: `${prefix}-LTS.rss`,
    stable: `${prefix}.rss`,
    beta: `${prefix}-NuBeta.rss`,
    unstable: `${prefix}-NuBeta-I.rss`,
  } as const satisfies { [c in Channel]: string };
}

/**
 * The Runtime RSS feeds that were used to build the *legacy* feed.
 * @deprecated Use the channel metadata in `channels.ts` instead.
 */
export function runtimeFeedUrls() {
  const prefix = `https://gms.yoyogames.com/Zeus-Runtime`;
  return {
    lts: `${prefix}-LTS.rss`,
    stable: `${prefix}.rss`,
    beta: `${prefix}-NuBeta.rss`,
    unstable: `${prefix}-NuBeta-I.rss`,
  } as const satisfies { [c in Channel]: string };
}
