import { z } from 'zod';

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

export type SpriteSourceStage = z.infer<typeof spriteStagingSchema>;
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
