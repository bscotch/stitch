import { z } from 'zod';

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

export type SpriteSourceRootSummary = z.infer<
  typeof spriteSourceRootSummarySchema
>;
export const spriteSourceRootSummarySchema = z.object({
  info: z
    .record(
      z.discriminatedUnion('spine', [spriteSummarySchema, spineSummarySchema]),
    )
    .default({}),
});
