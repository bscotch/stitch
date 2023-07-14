import { z } from 'zod';
import { yyParentSchema } from './YyBase.js';

export const yyExtensionStringTypeSchema = z
  .literal(1)
  .describe('Numeric index representing a string type.');
export const yyExtensionNumberTypeSchema = z
  .literal(2)
  .describe('Numeric index representing a double (real) type.');
export const yyExtensionValueTypeSchema = z.union([
  yyExtensionStringTypeSchema,
  yyExtensionNumberTypeSchema,
]);

export type YyExtensionConstantSchema = z.infer<
  typeof yyExtensionConstantSchema
>;
const yyExtensionConstantSchema = z.object({
  resourceType: z.literal('GMExtensionConstant').default('GMExtensionConstant'),
  resourceVersion: z.string().default('1.0'),
  name: z.string(),
  hidden: z.boolean().default(false),
  value: z
    .string()
    .describe(
      'The raw text value of the macro. Must be parsed as code to get the actual value.',
    ),
});

export type YyExtensionFunctionSchema = z.infer<
  typeof yyExtensionFunctionSchema
>;
const yyExtensionFunctionSchema = z.object({
  resourceType: z.literal('GMExtensionFunction').default('GMExtensionFunction'),
  resourceVersion: z.string().default('1.0'),
  name: z.string(),
  externalName: z.string(),
  documentation: z.string().default(''),
  argCount: z.number().default(0),
  args: z.array(yyExtensionValueTypeSchema).default([]),
  help: z
    .string()
    .describe('The function signature as a string, manually provided.'),
  hidden: z.boolean().default(false),
  kind: z.number().default(4),
  returnType: yyExtensionValueTypeSchema,
});

export type YyExtensionFileSchema = z.infer<typeof yyExtensionFileSchema>;
const yyExtensionFileSchema = z
  .object({
    resourceType: z.literal('GMExtensionFile'),
    resourceVersion: z.string().default('1.0'),
    functions: z.array(yyExtensionFunctionSchema).default([]),
  })
  .passthrough();

export type YyExtensionSchema = z.infer<typeof yyExtensionSchema>;
export const yyExtensionSchema = z
  .object({
    resourceType: z.literal('GMExtension').default('GMExtension'),
    resourceVersion: z.string().default('1.2'),
    name: z.string(),
    files: z.array(yyExtensionFileSchema).default([]),
    parent: yyParentSchema,
  })
  .passthrough();
