export type MoteId<Id extends string = string> = Id & { __moteId__: never };
export type SchemaId<Id extends string = string> = Id & { __schemaId__: never };
export type UidPoolId<Id extends string = string> = Id & {
  __uidPoolId__: never;
};

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

export interface Mote<T = unknown, S extends SchemaId = SchemaId> {
  id: MoteId;
  uid: UidPool;
  /** The actual data, as described by the schema */
  data: T;
  schema_id: S;
  /** MoteId of the parent mote */
  parent?: MoteId;
  /** Path to the field holding a sprite name */
  sprite?: string;
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

export interface BschemaMoteId extends BschemaString {
  format?: 'moteId';
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

export interface BschemaBsArray extends BschemaObject {
  format: 'bsArray';
  uniqueValue: ['element'];
  additionalProperties: {
    format: 'bsArrayElement';
    type: 'object';
    properties: { order: BschemaNumber; element: Bschema };
  };
}
