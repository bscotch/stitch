import { z } from 'zod';

export interface Log {
  action: 'deleted' | 'moved';
  path: string;
  to?: string;
}

export interface BBox {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

export interface Issue {
  level: 'error' | 'warning';
  message: string;
  cause?: any;
}

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

const spriteSourceTransformSchema = z.object({
  include: z
    .string()
    .optional()
    .describe(
      'Pattern to match against the folder path (relative to the staging root, using POSIX seps) for it to be included. If omitted, all sprites are included. Converted to a regex with `new RegExp(include)`.',
    ),
  bleed: z.boolean().optional().describe('Whether to bleed the image.'),
  crop: z.boolean().optional().describe('Whether to crop the image.'),
  synced: z
    .boolean()
    .optional()
    .describe(
      'Whether to sync the target folder to the staging folder, by deleting any files in the target folder that are not in the staging folder.',
    ),
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

export type SpriteStaging = z.infer<typeof spriteStagingSchema>;
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

export type SpriteSourceConfig = z.infer<typeof spriteSourceConfigSchema>;
export const spriteSourceConfigSchema = z.object({
  staging: z
    .array(spriteStagingSchema)
    .nullable()
    .describe(
      'List of folders and associated configs for raw images that should be preprocessed.',
    )
    .optional(),
  ignore: z
    .array(z.string())
    .nullable()
    .optional()
    .describe(
      'List of ignore patterns for sprites that should be excluded from caching and importing. Will be converted to a regex with `new RegExp(ignore)` and checked against the spritefolder path (relative to the SpritSource root, using POSIX seps).',
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

export type AnyFunction<R> = (
  ...args: any
) => R extends Promise<infer U> ? Promise<U> : R;
