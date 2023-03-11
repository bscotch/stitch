import { z } from 'zod';
export type GmlSpec = z.output<typeof gmlSpecSchema>;

const booleanStringSchema = z
  .union([z.literal('true'), z.literal('false')])
  .transform((v) => v === 'true');
const csvSchema = z.string().transform((v) => v.split(','));
const localeSchema = z.enum(['GB', 'US']);
const numberSchema = z
  .string()
  .refine((v) => /[\d.-]+/)
  .transform((v) => +v);
const featureFlagSchema = z.enum(['rollback', 'audio-fx']);

const gmlSpecFunctionSchema = z
  .object({
    $: z
      .object({
        Name: z.string(),
        Deprecated: booleanStringSchema,
        ReturnType: csvSchema,
        Pure: booleanStringSchema,
        Locale: localeSchema.optional(),
        FeatureFlag: featureFlagSchema.optional(),
      })
      .strict(),
    Description: z.tuple([z.string()]).optional(),
    Parameter: z
      .array(
        z
          .object({
            _: z.string().optional(),
            $: z
              .object({
                Name: z.string(),
                Type: csvSchema,
                Optional: booleanStringSchema,
                Coerce: booleanStringSchema.optional(),
              })
              .strict(),
          })
          .strict(),
      )
      .default([]),
  })
  .strict()
  .transform((v) => ({
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
  .object({
    _: z.string().optional(),
    $: z
      .object({
        Name: z.string(),
        Type: z.string(),
        Deprecated: booleanStringSchema,
        Get: booleanStringSchema,
        Set: booleanStringSchema,
        Instance: booleanStringSchema,
        FeatureFlag: featureFlagSchema.optional(),
        Locale: localeSchema.optional(),
      })
      .strict(),
  })
  .strict()
  .transform((v) => ({
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
  .object({
    _: z.string().optional(),
    $: z
      .object({
        Name: z.string(),
        Class: z.string().optional(),
        Type: z.string(),
        Deprecated: booleanStringSchema.optional(),
        FeatureFlag: featureFlagSchema.optional(),
        Locale: localeSchema.optional(),
      })
      .strict(),
  })
  .strict()
  .transform((v) => ({
    name: v.$.Name,
    description: v._,
    class: v.$.Class,
    type: v.$.Type,
    deprecated: v.$.Deprecated,
    featureFlag: v.$.FeatureFlag,
    locale: v.$.Locale,
  }));

const gmlSpecStructureSchema = z
  .object({
    $: z
      .object({
        Name: z.string(),
        FeatureFlag: featureFlagSchema.optional(),
      })
      .strict(),
    Field: z.array(
      z
        .object({
          _: z.string().optional(),
          $: z
            .object({
              Name: z.string(),
              Type: z.string(),
              Get: booleanStringSchema,
              Set: booleanStringSchema,
              Locale: localeSchema.optional(),
            })
            .strict(),
        })
        .strict()
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
  .strict()
  .transform((v) => ({
    name: v.$.Name,
    featureFlag: v.$.FeatureFlag,
    properties: v.Field,
  }));

const gmlSpecEnumerationSchema = z
  .object({
    $: z
      .object({
        Name: z.string(),
      })
      .strict(),
    Member: z.array(
      z
        .object({
          _: z.string().optional(),
          $: z
            .object({
              Name: z.string(),
              Value: numberSchema,
              Deprecated: booleanStringSchema,
            })
            .strict(),
        })
        .strict()
        .transform((v) => ({
          name: v.$.Name,
          description: v._,
          value: v.$.Value,
          deprecated: v.$.Deprecated,
        })),
    ),
  })
  .strict()
  .transform((v) => ({
    name: v.$.Name,
    members: v.Member,
  }));

export const gmlSpecSchema = z
  .object({
    GameMakerLanguageSpec: z
      .object({
        $: z.object({
          RuntimeVersion: z.string(),
        }),
        Functions: z.tuple([
          z.object({
            Function: z.array(gmlSpecFunctionSchema),
          }),
        ]),
        Variables: z.tuple([
          z.object({ Variable: z.array(gmlSpecVariableSchema) }),
        ]),
        Constants: z.tuple([
          z.object({ Constant: z.array(gmlSpecConstantSchema) }),
        ]),
        Structures: z.tuple([
          z.object({ Structure: z.array(gmlSpecStructureSchema) }),
        ]),
        Enumerations: z
          .tuple([z.object({ Enumeration: z.array(gmlSpecEnumerationSchema) })])
          .optional(),
      })
      .strict()
      .transform((v) => ({
        runtime: v.$.RuntimeVersion,
        functions: v.Functions[0].Function,
        variables: v.Variables[0].Variable,
        constants: v.Constants[0].Constant,
        structures: v.Structures[0].Structure,
        enumerations: v.Enumerations?.[0].Enumeration || [],
      })),
  })
  .strict()
  .transform((v) => v.GameMakerLanguageSpec);
