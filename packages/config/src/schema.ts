import { z } from 'zod';

export const stitchConfigFilename = 'stitch.config.json';

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

export type GameConsoleLineStyle = z.infer<typeof gameConsoleLineStyleSchema>;
export const gameConsoleLineStyleSchema = z.looseObject({
  base: z
    .string()
    .optional()
    .describe(
      "Base style to apply to the matching line (e.g. 'color: #808080; font-weight: bold;')",
    ),
  description: z
    .string()
    .optional()
    .describe('A description of the rule, for debugging purposes.'),
  pattern: z
    .string()
    .describe(
      'A regex pattern to match against the line. Named capture groups can be referenced in styles. Special names `_GMFILE_` and `_GMLINE_` may be used to enable linking to that part of the project code.',
    ),
  caseSensitive: z
    .boolean()
    .optional()
    .describe(
      'If true, the pattern will be treated as case-sensitive. Default is false.',
    ),
  styles: z
    .record(z.string(), z.string())
    .optional()
    .describe(
      "A map of CSS styles to apply to named capture groups in the line, as a CSS string (e.g. 'color: #808080').",
    ),
});

export type GameConsoleStyle = z.infer<typeof gameConsoleStyleSchema>;
export const gameConsoleStyleSchema = z
  .looseObject({
    base: z
      .string()
      .optional()
      .describe(
        "Base style to apply to all lines, as a CSS string (e.g. 'color: #808080')",
      ),
    lines: z
      .array(gameConsoleLineStyleSchema)
      .optional()
      .describe(
        "An array of style rules to apply to lines of the game's STDOUT/STDERR. The first matching rule is used for a given line.",
      ),
  })
  .describe(
    "Styling rules for the game's STDOUT/STDERR for compatible runners",
  );

export type StitchConfig = z.infer<typeof stitchConfigSchema>;
export const stitchConfigSchema = z
  .looseObject({
    $schema: z.literal(jsonSchemaUrl).optional().default(jsonSchemaUrl),
    textureGroupAssignments: z
      .record(z.string(), z.string())
      .optional()
      .describe(
        'A map of resource tree paths to texture group names. Supported Stitch utilities will use this to assign sprites in those paths (recursively) to the specified texture group. The most specific match is the on that gets applied.',
      ),
    audioGroupAssignments: z
      .record(z.string(), z.string())
      .optional()
      .describe(
        'A map of resource tree paths to audio group names. Supported Stitch utilities will use this to assign sounds in those paths (recursively) to the specified audio group. The most specific match is the on that gets applied.',
      ),
    runtimeVersion: z
      .string()
      .optional()
      .describe(
        'When set, supported Stitch utilities will preferentially use this GameMaker runtime version.',
      ),
    newSpriteRules: z
      .looseObject({ allowedNames })
      .optional()
      .describe(
        'Rules for creating new sprite resources, followed by supported Stitch utilities.',
      ),
    newSoundRules: z
      .looseObject({
        allowedNames,
        defaults: z
          .record(z.string(), newSoundDefaultsSchema)
          .optional()
          .describe(
            'Default properties for new sound assets, by name pattern. E.g. `{".*":{ mono: true}}` defaults all new sounds to mono. The first matching pattern is used.',
          ),
      })
      .optional()
      .describe(
        'Rules for creating new sound resources, followed by supported Stitch utilities.',
      ),
    gameConsoleStyle: gameConsoleStyleSchema.optional(),
  })
  .describe(
    'Stitch configuration schema. Stitch utilities may support subsets of this configuration.',
  );
