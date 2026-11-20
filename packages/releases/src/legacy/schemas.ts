/**
 * @file Schemas and types for the *legacy* (frozen) GameMaker releases
 * summary feed, which is still served at {@link legacyReleasesUrl} for
 * backwards compatibility but is no longer updated.
 * @deprecated Use the v2 feed instead.
 */
import { decode } from 'entities';
import { z } from 'zod';

/** A string schema that normalizes HTML content. */
function htmlString() {
  return z.string().transform((s) => {
    if (!s || typeof s !== 'string') {
      return s;
    }
    // decode HTML entities
    s = decode(s.trim());
    // remove anchor targets
    s = s.replace(/\btarget=[^\s>]+/g, '');
    // remove excess space
    s = s.replace(/ +/g, ' ');
    s = s.replace(/\r/g, '');
    s = s.replace(/[\t ]*\n[\t ]*(\n[\t ]*)+/g, '\n\n');
    return s;
  });
}

/** @deprecated Legacy feed channel names. */
export type Channel = (typeof channels)[number];
/** @deprecated Legacy feed channel names. */
export const channels = ['lts', 'stable', 'beta', 'unstable'] as const;
export const channelSchema = z.enum(channels);
Object.freeze(channels);

export type ArtifactType = (typeof artifactTypes)[number];
export const artifactTypes = ['ide', 'runtime'] as const;
Object.freeze(artifactTypes);

export type GameMakerArtifact = z.infer<typeof gameMakerArtifactSchema>;
export const gameMakerArtifactSchema = z.object({
  type: z.enum(artifactTypes),
  version: z.string().regex(/^\d+\.\d+\.\d+\.\d+$/),
  channel: channelSchema,
  summary: z.string().optional(),
  feedUrl: z.string(),
  publishedAt: z.string().transform((arg) => new Date(arg).toISOString()),
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
  publishedAt: z
    .string()
    .transform((arg) => new Date(arg).toISOString())
    .describe('Date of release for the IDE in this pair'),
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
