import { z } from 'zod';
import { nameField, unstable } from './utility.js';

export type yyParentSchema = z.infer<typeof yyParentSchema>;
export const yyParentSchema = z
  .object({
    name: z.string().describe("Folder's 'name' field"),
    path: z.string().describe("Folder's 'folderPath' field"),
  })
  .default({ name: 'NEW', path: 'folders/NEW.yy' });

export const configValuesSchema = z
  .record(z.string(), z.record(z.string(), z.string()))
  .optional();

export type YyBase = z.infer<typeof yyBaseSchema>;
export const yyBaseSchema = unstable({
  [nameField]: z.string().optional(),
  ConfigValues: configValuesSchema,
  name: z.string(),
  resourceType: z.string(),
  tags: z.array(z.string()).optional(),
  /**
   * Parent folder
   */
  parent: yyParentSchema,
  resourceVersion: z.string().default('1.0'),
});

export type YyResourceType = (typeof yyResourceTypes)[number];
export const yyResourceTypes = [
  'animcurves',
  'extensions',
  'fonts',
  'notes',
  'objects',
  'particles',
  'paths',
  'rooms',
  'roomui',
  'extensions',
  'scripts',
  'sequences',
  'shaders',
  'sounds',
  'sprites',
  'tilesets',
  'timelines',
] as const;
