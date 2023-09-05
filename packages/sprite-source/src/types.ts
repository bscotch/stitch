import { z } from 'zod';

const borderBoxSchema = z.object({
  left: z.number(),
  right: z.number(),
  top: z.number(),
  bottom: z.number(),
});

export type ImageSummary = z.infer<typeof imageSummarySchema>;
const imageSummarySchema = z.object({
  name: z.string(),
  width: z.number(),
  height: z.number(),
  box: borderBoxSchema,
  checksum: z.string(),
  changed: z.number().describe('Unix timestamp of last modification date.'),
});

const spriteSourceSummarySchema = z.object({
  path: z.string(),
  spine: z.boolean().optional().describe('Whether the image is a spine image.'),
  count: z.number().describe('Number of frames in the sprite.'),
  box: borderBoxSchema.describe(
    'Border-box that captures the border-boxes of all frames.',
  ),
  frames: z.record(imageSummarySchema),
});

const spriteSourceTransformSchema = z.object({
  include: z
    .array(z.string())
    .optional()
    .describe(
      'Sources matching these globs will be included. Follows .gitignore syntax and rules. If not provided all sources will be included.',
    ),
  bleed: z.boolean().default(false).describe('Whether to bleed the image.'),
  crop: z.boolean().default(false).describe('Whether to crop the image.'),
  renames: z
    .array(
      z.object({
        from: z
          .string()
          .describe(
            'Regex pattern to match against the filename, for use as the 1st arg in the JavaScript `String.replace` function.',
          ),
        to: z
          .string()
          .describe(
            'Replacement string for the filename, for use as the 2nd arg in the JavaScript `String.replace` function.',
          ),
      }),
    )
    .optional()
    .describe('Rules for renaming when moving to the SpriteSource directory.'),
});

const spriteStagingSchema = z.object({
  dir: z
    .string()
    .describe(
      'Path to the folder containing the raw images. Either relative to the SpriteSource root or absolute.',
    ),
  transforms: z
    .array(spriteSourceTransformSchema)
    .describe(
      'Transformations to apply to the raw images while moving them to the SpriteSource directory. Images are removed after a matching transform, and any images not matching any transforms are left alone.',
    ),
});

export type SpriteSourceRootSummary = z.infer<
  typeof spriteSourceRootSummarySchema
>;
export const spriteSourceRootSummarySchema = z.object({
  spriteCount: z.number(),
  frameCount: z.number(),
  staging: z
    .array(spriteStagingSchema)
    .describe(
      'List of folders and associated configs for raw images that should be preprocessed.',
    )
    .optional(),
  ignore: z
    .array(z.string())
    .describe(
      'List of ignore patterns for sprites that should be excluded from processing and caching.',
    ),
  sprites: z.record(spriteSourceSummarySchema),
});
