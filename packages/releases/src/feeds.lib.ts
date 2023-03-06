import { dateDifferenceDays } from '@bscotch/utility/browser';
import {
  RssFeedEntry,
  rssFeedSchema,
  type GameMakerArtifact,
} from './feeds.types.js';
import { fetchXml } from './fetch.js';

function daysApart(a: string, b: string) {
  return dateDifferenceDays(new Date(a), new Date(b));
}

function absoluteDaysApart(a: string, b: string) {
  return Math.abs(daysApart(a, b));
}

export function findPairedRuntime(
  runtimeFeed: GameMakerArtifact[],
  ide: GameMakerArtifact,
  searchIndex: number,
) {
  // Go backwards until the dateDiff starts growing
  let dateDiff = Infinity;
  for (let r = searchIndex; r >= 0; r--) {
    const runtime = runtimeFeed[r];
    if (!runtime.publishedAt || runtime.channel !== ide.channel) {
      continue;
    }
    const diff = absoluteDaysApart(runtime.publishedAt, ide.publishedAt);
    if (diff < dateDiff) {
      dateDiff = diff;
      searchIndex = r;
    } else {
      break;
    }
  }
  // Go forwards until the dateDiff starts growing
  dateDiff = Infinity;
  for (let r = searchIndex; r < runtimeFeed.length; r++) {
    const runtime = runtimeFeed[r];
    if (!runtime.publishedAt || runtime.channel !== ide.channel) {
      continue;
    }
    const diff = absoluteDaysApart(runtime.publishedAt, ide.publishedAt);
    if (diff < dateDiff) {
      dateDiff = diff;
      searchIndex = r;
    } else {
      break;
    }
  }
  const runtime = runtimeFeed[searchIndex];
  if (!runtime || absoluteDaysApart(runtime.publishedAt, ide.publishedAt) > 1) {
    return -1;
  }
  return searchIndex;
}

export async function downloadRssFeed(url: string): Promise<RssFeedEntry[]> {
  const feed = await fetchXml(url, rssFeedSchema);
  return feed.rss.channel.item;
}
