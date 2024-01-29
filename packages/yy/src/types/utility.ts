import { z } from 'zod';
import type { YyResourceType } from './YyBase.js';
import type { YypResourceId } from './Yyp.js';

export function randomString(length = 32) {
  let a = '';
  for (let i = 0; i < length; i++) {
    a += '0123456789ABCDEFGHIJKLMNOPQRSTUVWXTZabcdefghiklmnopqrstuvwxyz'[
      (Math.random() * 60) | 0
    ];
  }
  return a;
}

export class FixedNumber extends Number {
  constructor(
    value: number | FixedNumber,
    readonly digits = 1,
  ) {
    super(value.valueOf());
  }

  [Symbol.toPrimitive](hint: 'number' | 'default'): number;
  [Symbol.toPrimitive](hint: 'string'): string;
  [Symbol.toPrimitive](hint: 'number' | 'string' | 'default'): number | string {
    return hint === 'string' ? this.toString() : this.valueOf();
  }

  override toString(): string {
    return this.toFixed(this.digits);
  }

  toJSON(): number {
    return this.valueOf();
  }
}

/**
 * A wrapper that transforms the wrapped value to `undefined` and marks it as optional.
 * Useful for fields you want to provide for extra
 * information when transforming parents, since the
 * `z.input<>` inferred type will show this field,
 * but that don't normally exist in the source data.
 */
export function hint<T extends z.ZodTypeAny>(schema: T) {
  return schema.optional().transform(() => undefined);
}

export function fixedNumber(schema = z.number(), digits = 1) {
  const coercedToNumber = z.preprocess(
    (arg) =>
      arg instanceof FixedNumber || typeof arg === 'number' ? +arg : arg,
    schema,
  ) as z.ZodEffects<z.ZodNumber, number, number | FixedNumber>;
  return coercedToNumber.transform((value) => new FixedNumber(value, digits));
}

/**
 * Schema for a number or bigint cast to a bigint
 */
export function bigNumber() {
  return z
    .union([z.number(), z.bigint()])
    .transform((value) => (typeof value === 'bigint' ? value : BigInt(value)));
}

/**
 * Ensure that an object is initialized to an empty
 * object, allowing for default fields to be populated.
 */
export function ensureObject<T extends z.ZodTypeAny>(obj: T) {
  return z.preprocess((arg) => arg || {}, obj);
}

/**
 * Ensure that an array is initialized to an array with
 * at least one element, allowing for defaults to be
 * populated in each element.
 */
export function ensureObjects<
  T extends z.AnyZodObject | z.ZodEffects<any, any>,
>(obj: T, minItems = 1) {
  return z.preprocess((arg) => {
    arg = typeof arg === 'undefined' ? [] : arg;
    if (Array.isArray(arg) && arg.length < minItems) {
      const newItems = [...Array(Math.max(minItems - arg.length, 0))].map(
        () => ({}),
      );
      arg.push(...newItems);
    }
    return arg;
  }, z.array(obj));
}

/**
 * Shorthand for a `ZodObject` instance that doesn't strip
 * out any unknown keys, and that logs unexpected keys to
 * the console.
 */
export function unstable<T extends z.ZodRawShape>(shape: T): z.ZodObject<T> {
  return z.object(shape).catchall(
    z.unknown().superRefine((_arg, ctx) => {
      // The new format for name/resourcetype keys should be ignore, since those are handled in other ways.
      const isNewKey = `${ctx.path.at(-1)}`.match(/^[$%]/);
      if (!isNewKey) {
        console.log(`WARNING: Unexpected Key "${ctx.path.join('/')}"`);
      }
    }),
  );
}

export function getYyResourceId(
  yyType: YyResourceType,
  name: string,
): YypResourceId {
  return {
    name,
    path: `${yyType}/${name}/${name}.yy`,
  };
}

export function yyResourceIdSchemaGenerator(yyType: YyResourceType) {
  const pathFromName = (name: string) => `${yyType}/${name}/${name}.yy`;
  return z.preprocess(
    (arg) => {
      if (arg === null || !['undefined', 'object'].includes(typeof arg)) {
        return arg;
      }
      const objectId: { name?: string; path?: string } =
        arg === undefined ? {} : arg;
      if (objectId.name && !objectId.path) {
        objectId.path = pathFromName(objectId.name);
      }
      return objectId;
    },
    z
      .object({
        /** Object name */
        name: z.string(),
        /** Object resource path, e.g. "objects/{name}/{name}.yy" */
        path: z.string(),
      })
      .refine((arg) => arg.path === pathFromName(arg.name)),
  );
}

export function yyIsNewFormat<T>(yyData: T): yyData is T & { '%Name': string } {
  return (
    yyData &&
    typeof yyData === 'object' &&
    '%Name' in yyData &&
    yyData['%Name'] !== undefined
  );
}
