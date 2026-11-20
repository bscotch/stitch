/**
 * @file Schemas for the unified (v2) GameMaker releases feed.
 *
 * These schemas are also used to generate the published JSON Schema, so
 * they must not use transforms. Open-ended values (like channel names and
 * runtime kinds) are validated as strings rather than closed enums, so
 * that adding new values does not break already-installed consumers.
 */
import { z } from 'zod';

export const platforms = ['windows', 'mac', 'linux'] as const;
export type Platform = (typeof platforms)[number];

export const versionSchema = z
  .string()
  .regex(/^\d+\.\d+\.\d+\.\d+$/)
  .describe('A GameMaker version string, in the format YEAR.MINOR.PATCH.BUILD');

export const channelNameSchema = z
  .string()
  .regex(/^[a-z][a-z0-9]*$/)
  .describe(
    'A release channel name, e.g. "lts2026", "beta", or "unstable". New channels may be added over time (e.g. for new LTS series), so consumers should handle unknown names gracefully.',
  );

const dateSchema = z.iso.datetime().describe('An ISO 8601 date-time string');

export type ChannelInfo = z.infer<typeof channelInfoSchema>;
export const channelInfoSchema = z
  .object({
    name: channelNameSchema,
    kind: z
      .string()
      .describe(
        'The kind of channel. Currently one of "lts", "monthly", "beta", or "unstable".',
      ),
    status: z
      .string()
      .describe(
        'Whether the channel is still receiving releases. Currently one of "active" or "frozen".',
      ),
    title: z.string().describe('Human-friendly channel name'),
    description: z.string(),
    ideFeeds: z
      .partialRecord(z.enum(platforms), z.url())
      .describe("GameMaker's IDE RSS feed URL for each supported platform"),
    runtimeFeeds: z
      .array(z.url())
      .min(1)
      .describe(
        "GameMaker's Runtime RSS feed URLs for this channel. Runtimes are platform-agnostic.",
      ),
    userDirSuffix: z
      .string()
      .describe(
        'Suffix GameMaker adds to its user-data directory name for this channel, e.g. "-LTS2026" in "%APPDATA%/GameMakerStudio2-LTS2026". Verified on Windows.',
      ),
    minVersion: versionSchema
      .optional()
      .describe(
        "Releases older than this are excluded from the feed, even though they exist in GameMaker's feeds",
      ),
  })
  .describe('Metadata describing a GameMaker release channel');

export type GameMakerRuntimeRelease = z.infer<typeof runtimeReleaseSchema>;
export const runtimeReleaseSchema = z
  .object({
    kind: z
      .string()
      .describe(
        'The kind of runtime. Currently always "gms2" (the classic runtime, installed via Igor). Reserved for future runtimes like "gmrt".',
      ),
    version: versionSchema,
    publishedAt: dateSchema.describe(
      'Earliest publish date of this runtime across all of the feeds it appears in',
    ),
    channels: z
      .array(channelNameSchema)
      .min(1)
      .describe(
        'Channels whose runtime feeds include this runtime, most stable first',
      ),
    feedUrl: z
      .url()
      .describe(
        "A GameMaker Runtime RSS feed that contains this runtime, from the runtime's most stable channel. Can be passed to Igor to install the runtime.",
      ),
  })
  .describe(
    'The GameMaker Runtime that pairs with an IDE release. Pairings are inferred from version families, channels, and publish dates, unless manually overridden by Stitch maintainers.',
  );

export type GameMakerRelease = z.infer<typeof releaseSchema>;
export const releaseSchema = z
  .object({
    version: versionSchema.describe('The IDE version. Unique within the feed.'),
    family: z
      .string()
      .regex(/^\d+\.\d+\.\d+$/)
      .describe(
        'The YEAR.MINOR.PATCH family of the version. IDEs are only compatible with runtimes from the same family.',
      ),
    channels: z
      .array(channelNameSchema)
      .min(1)
      .describe('Channels this IDE version was released on, most stable first'),
    publishedAt: dateSchema.describe(
      'Earliest publish date of this IDE version across all of the feeds it appears in',
    ),
    downloads: z
      .partialRecord(z.enum(platforms), z.url())
      .describe('IDE installer URLs, for each platform it was released on'),
    runtime: runtimeReleaseSchema,
  })
  .describe('A GameMaker IDE release, and its paired Runtime');

export type GameMakerReleasesFeed = z.infer<typeof releasesFeedSchema>;
export const releasesFeedSchema = z
  .object({
    $schema: z.string().optional(),
    generatedAt: dateSchema,
    channels: z
      .array(channelInfoSchema)
      .describe('Release channels, most stable first'),
    releases: z
      .array(releaseSchema)
      .describe('GameMaker IDE releases, newest first'),
  })
  .describe(
    "Stitch's unified feed of GameMaker IDE releases and their paired Runtimes",
  );

/** Generate the JSON Schema for the releases feed. */
export function releasesFeedJsonSchema() {
  return z.toJSONSchema(releasesFeedSchema, { io: 'input' });
}
