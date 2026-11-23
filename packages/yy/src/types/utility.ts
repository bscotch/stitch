import { z } from 'zod';
import type { YyResourceType } from './YyBase.ts';
import type { YypResourceId } from './Yyp.ts';

export const nameField = '%Name';

type Primitive = string | number | bigint | boolean | symbol | null | undefined;

/**
 * Recursively make all properties of `T` optional,
 * including those of objects within arrays.
 */
export type PartialDeep<T> = T extends Primitive | ((...args: any[]) => unknown)
  ? T
  : T extends (infer U)[]
    ? PartialDeep<U>[]
    : T extends readonly (infer U)[]
      ? readonly PartialDeep<U>[]
      : T extends object
        ? { [K in keyof T]?: PartialDeep<T[K]> }
        : T;

export function randomString(length = 32) {
  let a = '';
  for (let i = 0; i < length; i++) {
    a += '0123456789ABCDEFGHIJKLMNOPQRSTUVWXTZabcdefghiklmnopqrstuvwxyz'[
      (Math.random() * 60) | 0
    ];
  }
  return a;
}

/**
 * Format a number the way GameMaker writes `double`-typed fields:
 * the shortest representation that round-trips, always with a decimal
 * point (e.g. `0.0`, `1.5`, `88.888885`), switching to .NET-style
 * scientific notation for very large or small values (e.g. `1.5E-05`).
 */
export function formatGameMakerFloat(value: number): string {
  if (!Number.isFinite(value)) return String(value);
  if (value === 0) return Object.is(value, -0) ? '-0.0' : '0.0';
  const [mantissa, exponentString] = value.toExponential().split('e');
  const exponent = Number(exponentString);
  if (exponent < -4 || exponent >= 15) {
    const sign = exponent < 0 ? '-' : '+';
    return `${mantissa}E${sign}${String(Math.abs(exponent)).padStart(2, '0')}`;
  }
  const asString = String(value);
  return asString.includes('.') ? asString : `${asString}.0`;
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

/**
 * Schema for a number or bigint cast to a bigint
 */
export function bigNumber() {
  return z
    .union([z.number(), z.bigint()])
    .transform((value) => (typeof value === 'bigint' ? value : BigInt(value)));
}

/**
 * Ensure that an array is initialized to an array with
 * at least one element, allowing for defaults to be
 * populated in each element.
 */
export function ensureObjects<T extends z.ZodObject>(obj: T, minItems = 1) {
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
  return z.looseObject(shape);
  // return z.object(shape).catchall(
  //   z.unknown().superRefine((_arg, ctx) => {
  //     // The new format for name/resourcetype keys should be ignore, since those are handled in other ways.
  //     ctx.issues.every((iss) => {
  //       const isNewKey = `${String(iss.path?.at(-1))}`.match(/^[$%]/);
  //       if (!isNewKey) {
  //         console.log(`WARNING: Unexpected Key "${iss.path?.join('/')}"`);
  //       }
  //     });
  //   }),
  // );
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
  if (!yyData || typeof yyData !== 'object') return false;
  if (nameField in yyData && yyData[nameField] !== undefined) return true;
  if ('resourceType' in yyData && yyData.resourceType === '2.0') return true;
  return false;
}

export function isObjectWithField<F extends string>(
  obj: unknown,
  field: F,
): obj is Record<string, unknown> & { [K in F]: unknown } {
  return (
    obj !== null &&
    typeof obj === 'object' &&
    field in obj &&
    (obj as Record<string, unknown>)[field] !== undefined
  );
}

export function assert(claim: any, message: string): asserts claim {
  if (!claim) throw new Error(message);
}

export function toPosixPath(path: string): string {
  return path.replace(/\\/g, '/');
}

export function parsePath(path: string): {
  filename: string;
  fullpath: string;
  parent: string;
  ext: `.${string}`;
} {
  path = toPosixPath(path);
  const parts = path.match(
    /^(?<parent>.*\/)?(?<filename>[^/]+?(?<ext>\.[^.]*)?)$/,
  );
  assert(parts, `Could not identify path parts of "${path}"`);
  return { ...parts.groups, fullpath: path } as any;
}

/**
 * Join path parts, ensuring exactly one POSIX separator is between
 * each part. Maintains initial and final seps.
 */
export function joinPaths(...parts: string[]): string {
  return parts
    .map((part, i) => {
      if (i === 0) return part.replace(/\/+$/, ''); // First part: trim end only
      if (i === parts.length - 1) return part.replace(/^\/+/, ''); // Last part: trim start only
      return part.replace(/^\/+|\/+$/g, ''); // Middle parts: trim both ends
    })
    .join('/');
}
