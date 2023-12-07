import {
  RssFeedEntry,
  rssFeedSchema,
  type GameMakerArtifact,
} from './feeds.types.js';
import { fetchXml } from './fetch.js';

/**
 * Get the runtime with the closest release date to the given IDE
 */
export function findPairedRuntime(
  runtimeFeed: GameMakerArtifact[],
  ide: GameMakerArtifact,
) {
  const location = runtimeFeed.reduce(
    (acc, cur, idx) => {
      if (!cur.publishedAt || cur.channel !== ide.channel) {
        return acc;
      }
      const diff = Math.abs(
        new Date(cur.publishedAt).getTime() -
          new Date(ide.publishedAt).getTime(),
      );
      if (diff < acc.minDiff) {
        acc.minDiff = diff;
        acc.minIndex = idx;
      }
      return acc;
    },
    {
      minDiff: Infinity,
      minIndex: -1,
    },
  );
  return location.minIndex === -1 ? undefined : runtimeFeed[location.minIndex];
}

export async function downloadRssFeed(url: string): Promise<RssFeedEntry[]> {
  const feed = await fetchXml(url, rssFeedSchema);
  return feed.rss.channel.item;
}
