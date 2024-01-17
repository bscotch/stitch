import { z } from 'zod';

export const cacheVersion = 2;

export type ImageSummary = z.infer<typeof imageSummarySchema>;
const imageSummarySchema = z.object({
  width: z.number(),
  height: z.number(),
  checksum: z.string().describe('Pixel-based checksum of the image.'),
  changed: z.number().describe('Unix timestamp of last modification date.'),
});

export type SpriteSummary = z.infer<typeof spriteSummarySchema>;
const spriteSummarySchema = z.object({
  spine: z.literal(false),
  checksum: z
    .string()
    .describe(
      'A checksum combining the pixel-based checksums of all of the frame checksums.',
    ),
  frames: z.record(imageSummarySchema),
});

export type SpineSummary = z.infer<typeof spineSummarySchema>;
const spineSummarySchema = z.object({
  spine: z.literal(true),
  checksum: z
    .string()
    .describe(
      'A checksum combining the pixel-based checksum of the atlas file with the contets of the atlas and json files.',
    ),
  changed: z
    .number()
    .describe(
      'Unix timestamp of the most recent modified date for all associate files (atlas, json, png).',
    ),
});

export type SpritesInfo = z.infer<typeof spritesInfoSchema>;
export const spritesInfoSchema = z.object({
  version: z.number().default(1),
  info: z
    .record(
      z.discriminatedUnion('spine', [spriteSummarySchema, spineSummarySchema]),
    )
    .default({}),
});
