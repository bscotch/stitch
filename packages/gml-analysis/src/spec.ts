/**
 * Reading GameMaker's `GmlSpec.xml` files, which describe the built-in
 * ("native") functions, variables, constants, structs and enums of each
 * runtime module.
 */
import { XMLParser } from 'fast-xml-parser';
import fs from 'node:fs/promises';
import { z } from 'zod';

export type GmlSpec = z.output<typeof gmlSpecSchema>;
export type GmlSpecFunction = GmlSpec['functions'][number];
export type GmlSpecVariable = GmlSpec['variables'][number];
export type GmlSpecConstant = GmlSpec['constants'][number];
export type GmlSpecStructure = GmlSpec['structures'][number];
export type GmlSpecEnumeration = GmlSpec['enumerations'][number];

/** The `GmlSpec.xml` that ships with this package, used when a runtime's own specs can't be found */
export const fallbackGmlSpecPath = new URL(
  '../assets/GmlSpec.xml',
  import.meta.url,
);

/**
 * Normalize the type strings used in specs. Most variations are handled by
 * the type parser; this only handles the `Array.String` form, which is
 * ambiguous with dotted type names.
 */
function normalizeSpecType(type: string): string {
  return type.replace(/^Array\.([A-Z][A-Z0-9]*)/gi, 'Array<$1>');
}

const booleanString = z
  .union([z.literal('true'), z.literal('false')])
  .transform((v) => v === 'true');
const typeString = z.string().transform(normalizeSpecType);
const locale = z.string();
const featureFlag = z.string();
const number = z
  .string()
  .refine((v) => /[\d.-]+/.test(v))
  .transform((v) => +v);

const functionSchema = z
  .strictObject({
    $: z.strictObject({
      Name: z.string(),
      Deprecated: booleanString,
      ReturnType: typeString,
      Pure: booleanString,
      Locale: locale.optional(),
      FeatureFlag: featureFlag.optional(),
    }),
    Description: z
      .array(
        // Self-closing <Description/> tags are parsed as empty objects
        z.preprocess(
          (i) =>
            i && typeof i === 'object' && !Object.keys(i).length ? '' : i,
          z.string(),
        ),
      )
      .optional(),
    Parameter: z
      .array(
        z.strictObject({
          _: z.string().optional(),
          $: z.strictObject({
            Name: z.string(),
            Type: typeString,
            Optional: booleanString,
            Coerce: booleanString.optional(),
          }),
        }),
      )
      .default([]),
  })
  .transform((v) => ({
    module: '',
    name: v.$.Name,
    description: v.Description?.[0] || undefined,
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

const variableSchema = z
  .strictObject({
    _: z.string().optional(),
    $: z.strictObject({
      Name: z.string(),
      Type: typeString,
      Deprecated: booleanString,
      Get: booleanString,
      Set: booleanString,
      Instance: booleanString,
      FeatureFlag: featureFlag.optional(),
      Locale: locale.optional(),
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

const constantSchema = z
  .strictObject({
    _: z.string().optional(),
    $: z.strictObject({
      Name: z.string(),
      Class: z.string().optional(),
      Type: typeString,
      Deprecated: booleanString.optional(),
      FeatureFlag: featureFlag.optional(),
      Locale: locale.optional(),
    }),
  })
  .transform((v) => ({
    module: '',
    name: v.$.Name,
    description: v._,
    class: v.$.Class || undefined,
    type: v.$.Type,
    deprecated: !!v.$.Deprecated,
    featureFlag: v.$.FeatureFlag,
    locale: v.$.Locale,
  }));

const structureSchema = z
  .strictObject({
    $: z.strictObject({
      Name: z.string(),
      FeatureFlag: featureFlag.optional(),
    }),
    Field: z
      .array(
        z
          .strictObject({
            _: z.string().optional(),
            $: z.strictObject({
              Name: z.string(),
              Type: typeString,
              Get: booleanString,
              Set: booleanString,
              Locale: locale.optional(),
            }),
          })
          .transform((v) => ({
            name: v.$.Name,
            description: v._,
            type: v.$.Type,
            readable: v.$.Get,
            writable: v.$.Set,
          })),
      )
      .default([]),
  })
  .transform((v) => ({
    module: '',
    name: v.$.Name,
    featureFlag: v.$.FeatureFlag,
    properties: v.Field,
  }));

const enumerationSchema = z
  .strictObject({
    $: z.strictObject({ Name: z.string() }),
    Member: z
      .array(
        z
          .strictObject({
            _: z.string().optional(),
            $: z.strictObject({
              Name: z.string(),
              Value: number,
              Deprecated: booleanString,
            }),
          })
          .transform((v) => ({
            name: v.$.Name,
            description: v._,
            value: v.$.Value,
            deprecated: v.$.Deprecated,
          })),
      )
      .default([]),
  })
  .transform((v) => ({ module: '', name: v.$.Name, members: v.Member }));

/** A section of the spec: absent, or a single element holding the entries */
function section<T extends z.ZodType>(key: string, entry: T) {
  return z
    .array(z.object({ [key]: z.array(entry).default([]) }))
    .optional()
    .transform(
      (v) =>
        ((v?.[0] as Record<string, unknown>)?.[key] || []) as z.output<T>[],
    );
}

export const gmlSpecSchema = z
  .strictObject({
    GameMakerLanguageSpec: z
      .strictObject({
        $: z.object({
          RuntimeVersion: z.string().optional(),
          Module: z.string().default('Unknown'),
        }),
        Functions: section('Function', functionSchema),
        Variables: section('Variable', variableSchema),
        Constants: section('Constant', constantSchema),
        Structures: section('Structure', structureSchema),
        Enumerations: section('Enumeration', enumerationSchema),
      })
      .transform((v) => {
        const spec = {
          runtime: v.$.RuntimeVersion,
          module: v.$.Module,
          functions: v.Functions,
          variables: v.Variables,
          constants: v.Constants,
          structures: v.Structures,
          enumerations: v.Enumerations,
        };
        for (const entries of [
          spec.functions,
          spec.variables,
          spec.constants,
          spec.structures,
          spec.enumerations,
        ]) {
          for (const entry of entries) entry.module = spec.module;
        }
        return spec;
      }),
  })
  .transform((v) => v.GameMakerLanguageSpec);

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '',
  attributesGroupName: '$',
  textNodeName: '_',
  parseTagValue: false,
  parseAttributeValue: false,
  trimValues: true,
  ignoreDeclaration: true,
  ignorePiTags: true,
  // Every element except the root is an array, so that modules with
  // single entries don't parse differently
  isArray: (tagName, jPath, _isLeaf, isAttribute) =>
    !isAttribute && tagName !== '$' && String(jPath).includes('.'),
  tagValueProcessor: (_tagName, value) => value.replace(/\s{2,}/g, ' ').trim(),
});

function emptyElementsToObjects(value: unknown): unknown {
  if (value === '') return {};
  if (Array.isArray(value)) return value.map(emptyElementsToObjects);
  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    for (const k of Object.keys(obj)) {
      if (k !== '$') obj[k] = emptyElementsToObjects(obj[k]);
    }
  }
  return value;
}

/** Parse the XML content of a `GmlSpec.xml` file */
export function parseGmlSpec(xml: string): GmlSpec {
  return gmlSpecSchema.parse(
    emptyElementsToObjects(xmlParser.parse(xml.replace(/^\uFEFF/, ''))),
  );
}

/** Read and parse a `GmlSpec.xml` file */
export async function readGmlSpec(file: string | URL): Promise<GmlSpec> {
  return parseGmlSpec(await fs.readFile(file, 'utf8'));
}
