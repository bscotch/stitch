import { z } from 'zod';

export interface SpriteDestAction {
  kind: 'update' | 'create';
  spine: boolean;
  /** The name of the sprite */
  name: string;
  /** The fullpath to the folder containing the source files */
  source: string;
  /** The fullpath to the {project}/sprites/{spriteName} folder where this sprite asset does (or should) live */
  dest: string;
  /** The fullpath to the SpriteSource folder containing this sprite */
  sourceRoot: string;
}

export type SpriteDestSource = z.infer<typeof spriteDestSourceSchema>;
const spriteDestSourceSchema = z.object({
  source: z
    .string()
    .describe(
      'Path to the SpriteSource directory. Either absolute or relative to the GameMaker project folder.',
    ),
  collaboratorSources: z
    .string()
    .array()
    .optional()
    .describe(
      "Paths to other SpriteSource directories that may overlap with this source. Any sprites that are found in the source *and* one or more collaborator sources must be the latest in 'source' for it to be imported as part of the pipeline.",
    ),
  ignore: z
    .array(z.string())
    .nullable()
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
  sources: z.array(spriteDestSourceSchema).default([]).optional(),
});
