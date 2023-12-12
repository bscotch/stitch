import { z } from 'zod';

export type MoteId<Id extends string = string> = Id;
export type SchemaId<Id extends string = string> = Id;
export type UidPoolId<Id extends string = string> = Id;

export interface PackedData {
  commitId: string;
  uid_pools: {
    [id: UidPoolId]: UidPool;
  };
  changes?: unknown;
  motes: {
    [id: MoteId]: Mote;
  };
  schemas: {
    [id: SchemaId]: Bschema;
  };
}

export interface UidPool {
  id: UidPoolId;
  history: number[];
  type: 'u16';
}

export interface Mote<T = any, S extends SchemaId = SchemaId> {
  id: MoteId;
  uid: UidPool;
  /** The actual data, as described by the schema */
  data: T;
  schema_id: S;
  /** MoteId of the parent mote */
  parent?: MoteId;
  /** Path to the field holding a sprite name */
  sprite?: string;
  /**
   * path relative to the parent, or to the root if there is not parent
   * of folders
   */
  folder?: string;
}

export type BschemaTypeName =
  | 'object'
  | 'string'
  | 'null'
  | '$ref'
  | 'bConst'
  | 'enum'
  | 'boolean'
  | 'number'
  | 'integer'
  | 'array';

export type Bschema =
  | BschemaObject
  | BschemaL10nString
  | BschemaString
  | BschemaMoteId
  | BschemaNull
  | BschemaRef
  | BschemaConst
  | BschemaEnum
  | BschemaBoolean
  | BschemaNumber
  | BschemaInteger
  | BschemaBsArray;

export function getProperties(
  schema: Bschema | undefined,
): BschemaObject['properties'] | undefined {
  if (!schema) return;
  if (isBschemaObject(schema)) {
    return schema.properties;
  }
  return;
}

export function getAdditionalProperties(
  schema: Bschema | undefined,
): Bschema | undefined {
  if (!schema) return;
  if (isBschemaObject(schema)) {
    return schema.additionalProperties;
  }
  return;
}

export function isBschemaObject(schema: any): schema is BschemaObject {
  return (
    typeof schema === 'object' &&
    (schema['type'] === 'object' ||
      (!schema['type'] &&
        (schema['properties'] || schema['additionalProperties'])))
  );
}

export function isBschemaEnum(schema: any): schema is BschemaEnum {
  return typeof schema === 'object' && Array.isArray(schema['enum']);
}

export function isBschemaConst(schema: any): schema is BschemaConst {
  return typeof schema === 'object' && 'bConst' in schema;
}

export function isBschemaString(schema: any): schema is BschemaString {
  return typeof schema === 'object' && schema['type'] === 'string';
}

export function isBschemaBoolean(schema: any): schema is BschemaBoolean {
  return typeof schema === 'object' && schema['type'] === 'boolean';
}

export function isBschemaNumeric(
  schema: any,
): schema is BschemaNumber | BschemaInteger {
  return (
    typeof schema === 'object' &&
    (schema['type'] === 'number' || schema['type'] === 'integer')
  );
}

interface BschemaBase {
  $id?: SchemaId;
  type?: BschemaTypeName;
  defaultValue?: string;

  hydratorId?: string;

  /**
   * A partial schema that will overwrite fields of the current one
   */
  overrides?: string;

  /**
   * Internal pointer to the field that holds the mote's name
   */
  name?: string;
  title?: string;
  description?: string;
  access?: string;
  order?: string;
  collapsible?: string;
  copyable?: string;
  convertible?: string;
  group?: string;
}

export interface BschemaObject extends BschemaBase {
  type: 'object';
  properties?: {
    [key: string]: Bschema;
  };
  required?: string[];
  additionalProperties?: Bschema;
  discriminator?: { propertyName: string };
  minProperties?: number;
  maxProperties?: number;
  uniqueValues?: string[];
  oneOf?: Bschema[];
}

export interface BschemaNull extends BschemaBase {
  type: 'null';
}

export interface BschemaRoot extends BschemaObject {
  sortPath?: string;
  status?: string;
  uidPool?: UidPoolId;
  subschema?: boolean;
  sprite?: string;
}

export interface BschemaRef extends BschemaBase {
  type?: '$ref';
  $ref: string;
}

export interface BschemaConst extends BschemaBase {
  type?: 'bConst';
  bConst: any;
}

export interface BschemaEnum extends BschemaBase {
  type?: 'enum';
  enum: any[];
}

export interface BschemaString extends BschemaBase {
  type: 'string';
  minLength?: number;
  maxLength?: number;

  /**
   * A substring that the string must contain
   */
  stringContains?: string;
}

export interface BschemaL10nString extends BschemaString {
  format: 'l10n';
}

export interface BschemaMoteId extends BschemaString {
  format: 'moteId';
  formatProperties?: {
    blockSchemas?: SchemaId[];
    allowSchemas?: SchemaId[];
    blockMotes?: MoteId[];
    allowMotes?: MoteId[];
    allowLooping?: boolean;
    validationSchema?: Bschema;
  };
}

export interface BschemaBoolean extends BschemaBase {
  type: 'boolean';
}

interface BschemaNumberBase extends BschemaBase {
  minimum?: number;
  exclusiveMinimum?: number;
  maximum?: number;
  exclusiveMaximum?: number;
  multipleOf?: number;
  percent?: boolean;
  slider?: boolean;
  percentSlider?: boolean;
  arrayOrder?: boolean;
  arraySlot?: boolean;
}

export interface BschemaNumber extends BschemaNumberBase {
  type: 'number';
}
export interface BschemaInteger extends BschemaNumberBase {
  type: 'integer';
}

export interface BschemaBsArrayElement extends BschemaObject {
  format: 'bsArrayElement';
  type: 'object';
  properties: { order: BschemaNumber; element: Bschema };
}

export interface BschemaBsArray extends BschemaObject {
  format: 'bsArray';
  uniqueValue: ['element'];
  additionalProperties: BschemaBsArrayElement;
}

export type ChangeType = z.infer<typeof changeTypeSchema>;
const changeTypeSchema = z
  .union([z.literal('added'), z.literal('deleted'), z.literal('changed')])
  .describe(
    `The type of change that occurred. 'added' and 'deleted' refer to the mote itself, while everything else is a 'change'.`,
  );

export type Change = z.infer<typeof changeSchema>;
export const changeSchema = z
  .object({
    mote_id: z
      .string()
      .optional()
      .describe('If this was a mote change, the ID of that mote.'),
    schema_id: z
      .string()
      .describe(
        `If this was a mote change, the mote's schema. Otherwise, the schema that changed.`,
      ),
    type: changeTypeSchema,
    schema_title: z
      .string()
      .optional()
      .describe('Stored for posterity in case the name changes.'),
    mote_name: z
      .string()
      .optional()
      .describe(
        `If this was a mote change, the mote's name. Stored for posterity in case the name changes.`,
      ),
    allowed: z
      .union([z.boolean(), z.number()])
      .default(true)
      .describe(
        'Whether or not the current user is allowed to make this change.',
      ),
    staged: z
      .union([z.boolean(), z.number()])
      .default(false)
      .describe('Whether or not the change is staged.'),
    diffs: z
      .record(z.tuple([z.any(), z.any()]))
      .optional()
      .describe(
        'Changes, keyed by the JSON Pointer-ish (e.g. "data/quest_end_moments/g803/order") path to the field. Values are [before,after], where "null" is used to represent added/deleted values.',
      ),
  })
  .passthrough();

export type Changes = z.infer<typeof changesSchema>;
export const changesSchema = z
  .object({
    commitId: z
      .string()
      .regex(/^c\d+$/)
      .describe('The base GameChanger commit these changes are relative to'),
    changes: z.object({
      message: z
        .string()
        .describe('The commit message for the changes. Can be a null string.'),
      motes: z.record(changeSchema).default({}),
      /** Schema changes. */
      schemas: z.record(changeSchema).default({}),
      /** Cache of known conflicts */
      conflicts: z
        .object({
          motes: z.record(z.any()).default({}),
          schemas: z.record(z.any()).default({}),
        })
        .passthrough(),
    }),
  })
  .passthrough();
