import { z } from 'zod';
import { normalizeTypeString } from './util.js';
export type GmlSpec = z.output<typeof gmlSpecSchema>;
export type GmlSpecFunction = GmlSpec['functions'][number];
export type GmlSpecVariable = GmlSpec['variables'][number];
export type GmlSpecConstant = GmlSpec['constants'][number];
export type GmlSpecEntry = GmlSpecFunction | GmlSpecVariable | GmlSpecConstant;

const booleanStringSchema = z
  .union([z.literal('true'), z.literal('false')])
  .transform((v) => v === 'true');
const typeStringSchema = z.string().transform((v) => normalizeTypeString(v));
const localeSchema = z.enum(['GB', 'US']);
const numberSchema = z
  .string()
  .refine((v) => /[\d.-]+/.test(v))
  .transform((v) => +v);
/**
 * There appear to be a very small number of allowed strings, but
 * they can change with new spec versions so we shouldn't have strong
 * opinions about them.
 */
const featureFlagSchema = z.string();

const gmlSpecFunctionSchema = z
  .strictObject({
    $: z.strictObject({
      Name: z.string(),
      Deprecated: booleanStringSchema,
      ReturnType: typeStringSchema,
      Pure: booleanStringSchema,
      Locale: localeSchema.optional(),
      FeatureFlag: featureFlagSchema.optional(),
    }),
    Description: z.array(z.string()).optional(),
    Parameter: z
      .array(
        z.strictObject({
          _: z.string().optional(),
          $: z.strictObject({
            Name: z.string(),
            Type: typeStringSchema,
            Optional: booleanStringSchema,
            Coerce: booleanStringSchema.optional(),
          }),
        }),
      )
      .default([]),
  })
  .transform((v) => ({
    module: '',
    name: v.$.Name,
    description: v.Description?.[0],
    deprecated: v.$.Deprecated,
    pure: v.$.Pure,
    returnType: v.$.ReturnType,
    featureFlag: v.$.FeatureFlag,
    locale: v.$.Locale,
    parameters: v.Parameter.map((p) => ({
      name: p.$.Name,
      description: p._,
      type: p.$.Type,
      optional: p.$.Optional,
      coerce: p.$.Coerce,
    })),
  }));

const gmlSpecVariableSchema = z
  .strictObject({
    _: z.string().optional(),
    $: z.strictObject({
      Name: z.string(),
      Type: typeStringSchema,
      Deprecated: booleanStringSchema,
      Get: booleanStringSchema,
      Set: booleanStringSchema,
      Instance: booleanStringSchema,
      FeatureFlag: featureFlagSchema.optional(),
      Locale: localeSchema.optional(),
    }),
  })
  .transform((v) => ({
    module: '',
    name: v.$.Name,
    description: v._,
    type: v.$.Type,
    deprecated: v.$.Deprecated,
    readable: v.$.Get,
    writable: v.$.Set,
    instance: v.$.Instance,
    featureFlag: v.$.FeatureFlag,
    locale: v.$.Locale,
  }));

const gmlSpecConstantSchema = z
  .strictObject({
    _: z.string().optional(),
    $: z.strictObject({
      Name: z.string(),
      Class: z.string().optional(),
      Type: typeStringSchema,
      Deprecated: booleanStringSchema.optional(),
      FeatureFlag: featureFlagSchema.optional(),
      Locale: localeSchema.optional(),
    }),
  })
  .transform((v) => ({
    module: '',
    name: v.$.Name,
    description: v._,
    class: v.$.Class,
    type: v.$.Type,
    deprecated: v.$.Deprecated,
    featureFlag: v.$.FeatureFlag,
    locale: v.$.Locale,
  }));

const gmlSpecStructureSchema = z
  .strictObject({
    $: z.strictObject({
      Name: z.string(),
      FeatureFlag: featureFlagSchema.optional(),
    }),
    Field: z.array(
      z
        .strictObject({
          _: z.string().optional(),
          $: z.strictObject({
            Name: z.string(),
            Type: typeStringSchema,
            Get: booleanStringSchema,
            Set: booleanStringSchema,
            Locale: localeSchema.optional(),
          }),
        })
        .transform((v) => ({
          name: v.$.Name,
          description: v._,
          type: v.$.Type,
          readable: v.$.Get,
          writable: v.$.Set,
          locale: v.$.Locale,
        })),
    ),
  })
  .transform((v) => ({
    module: '',
    name: v.$.Name,
    featureFlag: v.$.FeatureFlag,
    properties: v.Field,
  }));

const gmlSpecEnumerationSchema = z
  .strictObject({
    $: z.strictObject({
      Name: z.string(),
    }),
    Member: z.array(
      z
        .strictObject({
          _: z.string().optional(),
          $: z.strictObject({
            Name: z.string(),
            Value: numberSchema,
            Deprecated: booleanStringSchema,
          }),
        })
        .transform((v) => ({
          name: v.$.Name,
          description: v._,
          value: v.$.Value,
          deprecated: v.$.Deprecated,
        })),
    ),
  })
  .transform((v) => ({
    module: '',
    name: v.$.Name,
    members: v.Member,
  }));

export const gmlSpecSchema = z
  .strictObject({
    GameMakerLanguageSpec: z
      .strictObject({
        $: z.object({
          RuntimeVersion: z.string(),
          Module: z.string().default('Unknown'),
        }),
        // Should have length 0 or 1
        Functions: z
          .array(
            z.object({
              Function: z.array(gmlSpecFunctionSchema).default([]),
            }),
          )
          .optional(),
        // Should have length 0 or 1
        Variables: z
          .array(
            z.object({
              Variable: z.array(gmlSpecVariableSchema).default([]),
            }),
          )
          .optional(),
        // Should have length 0 or 1
        Constants: z
          .array(
            z.object({
              Constant: z.array(gmlSpecConstantSchema).default([]),
            }),
          )
          .optional(),
        // Should have length 0 or 1
        Structures: z
          .array(
            z.object({
              Structure: z.array(gmlSpecStructureSchema).default([]),
            }),
          )
          .optional(),
        // Should have length 0 or 1
        Enumerations: z
          .array(
            z.object({
              Enumeration: z.array(gmlSpecEnumerationSchema).default([]),
            }),
          )
          .optional(),
      })
      .transform((v) => {
        const out = {
          runtime: v.$.RuntimeVersion,
          module: v.$.Module,
          functions: v.Functions?.[0].Function || [],
          variables: v.Variables?.[0].Variable || [],
          constants: v.Constants?.[0].Constant || [],
          structures: v.Structures?.[0].Structure || [],
          enumerations: v.Enumerations?.[0].Enumeration || [],
        };
        // Update all the entries to have the correct module name.
        for (const entryType of [
          'functions',
          'variables',
          'constants',
          'structures',
          'enumerations',
        ] as const) {
          for (const entry of out[entryType]) {
            entry.module = out.module;
          }
        }
        return out;
      }),
  })
  .transform((v) => v.GameMakerLanguageSpec);
