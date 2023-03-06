import { z } from 'zod';
import { htmlString } from './utils.js';

export interface RssFeedEntry {
  title: string;
  pubDate: string;
  link?: string;
  comments: string;
  description?: string;
}

export type Channel = typeof channels[number];
export const channels = ['lts', 'stable', 'beta', 'unstable'] as const;
export const channelSchema = z.enum(channels);
Object.freeze(channels);

export type ArtifactType = typeof artifactTypes[number];
export const artifactTypes = ['ide', 'runtime'] as const;
Object.freeze(artifactTypes);

export const rssFeedSchema = z.object({
  rss: z.object({
    channel: z.object({
      title: htmlString(),
      description: htmlString(),
      link: z.string(),
      item: z.preprocess(
        (arg) => {
          if (!Array.isArray(arg)) {
            return [arg];
          }
          return arg;
        },
        z.array(
          z.object({
            title: z.string().regex(/^Version \d+\.\d+\.\d+\.\d+$/),
            pubDate: z.string(),
            link: z.string().optional(),
            comments: z.string(),
            description: htmlString().optional(),
          }),
        ),
      ),
    }),
  }),
});

export type GameMakerArtifact = z.infer<typeof gameMakerArtifactSchema>;
export const gameMakerArtifactSchema = z.object({
  type: z.enum(artifactTypes),
  version: z.string().regex(/^\d+\.\d+\.\d+\.\d+$/),
  channel: channelSchema,
  summary: z.string().optional(),
  feedUrl: z.string(),
  publishedAt: z.string(),
  link: z.string().optional(),
  notesUrl: z.string(),
});

export type GameMakerArtifactWithNotes = z.infer<
  typeof gameMakerArtifactWithNotesSchema
>;
export const gameMakerArtifactWithNotesSchema = gameMakerArtifactSchema.extend({
  notes: z.object({
    since: z.string().nullable(),
    groups: z.array(
      z.object({
        title: htmlString(),
        changes: z.array(htmlString()),
      }),
    ),
  }),
});

const gameMakerReleaseBaseSchema = z.object({
  channel: channelSchema,
  publishedAt: z.string().describe('Date of release for the IDE in this pair'),
  summary: htmlString().describe(
    'Summary of the release, from the RSS feed for the IDE',
  ),
});

export type GameMakerReleaseWithNotes = z.infer<
  typeof gameMakerReleaseWithNotesSchema
>;
export const gameMakerReleaseWithNotesSchema =
  gameMakerReleaseBaseSchema.extend({
    ide: gameMakerArtifactWithNotesSchema.omit({ summary: true }),
    runtime: gameMakerArtifactWithNotesSchema.omit({ summary: true }),
  });

export type GameMakerRelease = z.infer<typeof gameMakerReleaseSchema>;
export const gameMakerReleaseSchema = gameMakerReleaseBaseSchema.extend({
  ide: gameMakerArtifactSchema.omit({ summary: true }),
  runtime: gameMakerArtifactSchema.omit({ summary: true }),
});

export type RawReleaseNote = z.infer<typeof rawReleaseNoteSchema>;
export const rawReleaseNoteSchema = z
  .object({
    type: z.enum(artifactTypes).optional(),
    version: z.string(),
    release_notes: z.array(z.string()),
  })
  .strict();

export type RawReleaseNotesCache = Record<string, RawReleaseNote>;
export const rawReleaseNotesCacheSchema = z.record(rawReleaseNoteSchema);
