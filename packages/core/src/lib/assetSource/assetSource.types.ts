import { assert, isValidDate } from '@bscotch/utility';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';

export function isDeletedAsset(
  meta: Asset | DeletedAsset,
): meta is DeletedAsset {
  return !!('deleted' in meta && meta.deleted);
}

const assetFileBaseSchema = z.object({
  id: z
    .string()
    .uuid()
    .default(uuidv4)
    .describe(
      `Unique identifier, created by Stitch, to identify the asset even if it is renamed or deleted.`,
    ),
  path: z.string().describe('Path to the audio file, relative to this config.'),
  version: z
    .number()
    .default(0)
    .describe(
      'Version of the audio file, incrementing on each detected change.',
    ),
  importable: z
    .boolean()
    .default(false)
    .describe(
      'Whether or not the file is ready to be imported into the target project.',
    ),
});

export type DeletedAsset = z.infer<typeof deletedAssetSchema>;
export const deletedAssetSchema = assetFileBaseSchema.extend({
  deleted: z.literal(true).describe('If true, the asset has been deleted'),
  importable: z.literal(false).default(false),
});

export type Asset = z.infer<typeof assetSchema>;
export const assetSchema = assetFileBaseSchema.extend({
  deleted: z.literal(false).optional(),
  checksum: z.string().optional().describe('MD5 checksum of the audio file.'),
  updatedAt: z.union([z.string(), z.date()]).transform((s) => {
    const asDate = new Date(s);
    assert(isValidDate(asDate), `Invalid date: ${s}`);
    return asDate.toISOString();
  }),
});

export type AudioAsset = z.infer<typeof audioFileSchema>;
export const audioFileSchema = assetSchema.merge(
  z.object({
    duration: z
      .number()
      .optional()
      .describe('Duration of the audio file, in seconds.'),
  }),
);

export const sourceConfigBaseSchema = z.object({
  id: z.string().uuid().default(uuidv4),
  type: z.literal('audio'),
  name: z
    .string()
    .optional()
    .describe('Name of the source, for display purposes.'),
  description: z
    .string()
    .optional()
    .describe('Description of the source, for display purposes.'),
});

export type AudioSourceConfig = z.infer<typeof audioSourceConfigSchema>;
export const audioSourceConfigSchema = sourceConfigBaseSchema.extend({
  type: z.literal('audio').default('audio'),
  groupBy: z
    .array(z.string())
    .default(['^(?<group>.+)[_-]\\d+\\.([^.]+)$', '^(?<group>.+)\\.([^.]+)$'])
    .describe(
      'Array of regex patterns that include a named capture group, `?<group>`, used to group audio files. Patterns are tested against the path, relative to the location of the config file. The first pattern to match will be used for grouping. Groups may be used by downstream display, reporting, and/or pipeline tools.',
    ),
  files: z.array(z.union([audioFileSchema, deletedAssetSchema])).default([]),
});

export type SourceConfig = z.infer<typeof sourceConfigSchema>;
export const sourceConfigSchema = audioSourceConfigSchema;
export type GroupedSourceConfig<T extends SourceConfig> = T & {
  groups: { name: string; files: T['files'] }[];
};

export type ConfigFile = z.infer<typeof configFileSchema>;
export const configFileSchema = z.object({
  version: z.literal(1).default(1).describe('Configuration file version.'),
  sources: z.array(audioSourceConfigSchema).default([]),
});
