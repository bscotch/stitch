/**
 * @file Downloading and parsing GameMaker's IDE and Runtime RSS feeds.
 */
import { XMLParser } from 'fast-xml-parser';
import { z } from 'zod';
import { fetchText } from './fetch.ts';

/** A single entry from a GameMaker IDE or Runtime RSS feed. */
export interface FeedEntry {
  /** The (normalized) GameMaker version */
  version: string;
  /** ISO date string */
  publishedAt: string;
  /** For IDE feeds, the installer URL */
  link?: string;
  /** The feed this entry came from */
  feedUrl: string;
}

const rssItemSchema = z.object({
  title: z.string().regex(/^Version \d+\.\d+\.\d+\.\d+$/),
  pubDate: z.string(),
  link: z.string().optional(),
  enclosure: z.object({ '@_url': z.string().optional() }).optional(),
});

const rssFeedSchema = z.object({
  rss: z.object({
    channel: z.object({
      item: z.preprocess(
        (arg) => (arg === undefined ? [] : Array.isArray(arg) ? arg : [arg]),
        z.array(rssItemSchema),
      ),
    }),
  }),
});

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  // Ensure single-item feeds still produce an array
  isArray: (name) => name === 'item',
});

/**
 * Parse the content of a GameMaker IDE or Runtime RSS feed into a list
 * of entries.
 */
export function parseFeed(xml: string, feedUrl: string): FeedEntry[] {
  let items: z.infer<typeof rssItemSchema>[];
  try {
    items = rssFeedSchema.parse(xmlParser.parse(xml)).rss.channel.item;
  } catch (err) {
    throw new Error(`Unexpected content in GameMaker feed ${feedUrl}`, {
      cause: err,
    });
  }
  return items.map((item) => {
    const publishedAt = new Date(item.pubDate);
    if (isNaN(publishedAt.getTime())) {
      throw new Error(
        `Invalid pubDate "${item.pubDate}" for "${item.title}" in ${feedUrl}`,
      );
    }
    const version = item.title
      .replace(/^Version /, '')
      .split('.')
      .map((n) => parseInt(n, 10))
      .join('.');
    return {
      version,
      publishedAt: publishedAt.toISOString(),
      link: item.link || item.enclosure?.['@_url'] || undefined,
      feedUrl,
    };
  });
}

/** Download and parse a GameMaker IDE or Runtime RSS feed. */
export async function fetchFeed(feedUrl: string): Promise<FeedEntry[]> {
  const entries = parseFeed(await fetchText(feedUrl), feedUrl);
  if (!entries.length) {
    throw new Error(`GameMaker feed ${feedUrl} has no entries`);
  }
  return entries;
}
