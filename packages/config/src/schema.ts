import { z } from 'zod';

const allowedNames = z
  .array(z.string())
  .optional()
  .describe(
    'A list of regex patterns that new assets must match. Enforced by supported Stitch utilities.',
  );
export const jsonSchemaUrl =
  'https://raw.githubusercontent.com/bscotch/stitch/develop/packages/config/schemas/stitch.config.schema.json';

export type NewSoundDefaults = z.infer<typeof newSoundDefaultsSchema>;
export const newSoundDefaultsSchema = z.object({
  mono: z
    .boolean()
    .optional()
    .describe(
      'Whether to default new sounds to mono. When not set, the default is stereo.',
    ),
});

export type StitchConfig = z.infer<typeof stitchConfigSchema>;
export const stitchConfigSchema = z
  .object({
    $schema: z.literal(jsonSchemaUrl).default(jsonSchemaUrl),
    textureGroupAssignments: z
      .record(z.string())
      .default({})
      .describe(
        'A map of resource tree paths to texture groups name. Supported Stitch utilities will use this to assign sprites in those paths (recursively) to the specified texture group.',
      ),
    audioGroupAssignments: z
      .record(z.string())
      .default({})
      .describe(
        'A map of resource tree paths to audio groups name. Supported Stitch utilities will use this to assign sounds in those paths (recursively) to the specified audio group.',
      ),
    runtimeVersion: z
      .string()
      .optional()
      .describe(
        'When set, supported Stitch utilities will preferentially use this GameMaker runtime version.',
      ),
    newSpriteRules: z
      .object({ allowedNames })
      .passthrough()
      .optional()
      .describe(
        'Rules for creating new sprite resources, followed by supported Stitch utilities.',
      ),
    newSoundRules: z
      .object({
        allowedNames,
        defaults: z
          .record(newSoundDefaultsSchema)
          .optional()
          .describe(
            'Default properties for new sound assets, by name pattern. E.g. `{".*":{ mono: true}}` defaults all new sounds to mono. The first matching pattern is used.',
          ),
      })
      .passthrough()
      .optional()
      .describe(
        'Rules for creating new sound resources, followed by supported Stitch utilities.',
      ),
  })
  .passthrough()
  .describe(
    'Stitch configuration schema. Stitch utilities may support subsets of this configuration.',
  );
