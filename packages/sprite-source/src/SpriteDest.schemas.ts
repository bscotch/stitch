import { z } from 'zod';

export type SpriteDestSource = z.infer<typeof spriteDestSourceSchema>;
export const spriteDestSourceSchema = z.object({
  source: z
    .string()
    .describe(
      'Path to the SpriteSource directory. Either absolute or relative to the GameMaker project folder.',
    ),
  ignore: z
    .string()
    .optional()
    .describe(
      'Pattern to match against the folder path (relative to the SpriteSource root, using POSIX seps) for it to be skipped during import. If omitted, all sprites are included. Converted to a regex with `new RegExp(ignore)`.',
    ),
  prefix: z
    .string()
    .optional()
    .describe(
      'Prefix to add to the sprite name when adding to the project as a sprite asset.',
    ),
});

export type SpriteDestConfig = z.infer<typeof spriteDestConfigSchema>;
export const spriteDestConfigSchema = z.object({
  sources: z.array(spriteDestSourceSchema).default([]),
});
