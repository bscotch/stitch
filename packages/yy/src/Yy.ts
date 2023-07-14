import { sortKeysByReference } from '@bscotch/utility';
import { ok } from 'assert';
import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';
import { PartialDeep } from 'type-fest';
import { Schema, z } from 'zod';
import { parseYy } from './Yy.parse.js';
import { stringifyYy } from './Yy.stringify.js';
import { YyResourceType } from './types/YyBase.js';
import { yyExtensionSchema } from './types/YyExtension.js';
import { yyObjectSchema } from './types/YyObject.js';
import { yyRoomSchema } from './types/YyRoom.js';
import { yyScriptSchema } from './types/YyScript.js';
import { yySoundSchema } from './types/YySound.js';
import { yySpriteSchema } from './types/YySprite.js';
import { yypSchema } from './types/Yyp.js';

export type YySchemaRef = YyResourceType | 'project' | Schema | undefined;
export type YySchemaName = keyof YySchemas;
export type YySchema<T extends YySchemaRef> = T extends YySchemaName
  ? YySchemas[T]
  : T extends Schema
  ? T
  : unknown;
export type YyDataStrict<T extends YySchemaRef> = T extends undefined
  ? unknown
  : z.output<YySchema<Exclude<T, undefined>>>;
export type YyDataLoose<T extends YySchemaRef> = T extends undefined
  ? unknown
  : z.input<YySchema<Exclude<T, undefined>>>;

const anyObject = z.object({}).passthrough();

export type YySchemas = typeof yySchemas;
export const yySchemas = {
  project: yypSchema,
  animcurves: anyObject,
  extensions: yyExtensionSchema,
  fonts: anyObject,
  notes: anyObject,
  objects: yyObjectSchema,
  particles: anyObject,
  paths: anyObject,
  rooms: yyRoomSchema,
  scripts: yyScriptSchema,
  sequences: anyObject,
  shaders: anyObject,
  sounds: yySoundSchema,
  sprites: yySpriteSchema,
  tilesets: anyObject,
  timelines: anyObject,
} as const satisfies { [K in YyResourceType | 'project']: Schema };
Object.freeze(yySchemas);
Object.seal(yySchemas);

export type YyDiff = { [path: string]: { left?: any; right?: any } };

export class Yy {
  // Hide the constructor since it's not meant to be used.
  protected constructor() {}

  static readonly schemas = yySchemas;

  static getSchema<T extends YySchemaRef>(ref: T): YySchema<T> {
    const schema =
      typeof ref === 'string' ? Yy.schemas[ref as YySchemaName] : ref;
    ok(schema, `No schema found for ${ref}`);
    return schema as any;
  }

  /**
   * Stringify an object into a Yy-formatted string,
   * including trailing commas. If a schema is provided,
   * it will be used to validate and populate defaults before
   * stringifying.
   */
  static stringify(yyObject: unknown, schema?: YySchemaRef): string {
    if (typeof schema === 'string') {
      schema = Yy.schemas[schema];
    }
    return stringifyYy(schema ? schema.parse(yyObject) : yyObject);
  }

  static parse<T extends YySchemaRef>(
    yyString: string,
    schema?: T,
  ): YyDataStrict<T> {
    return parseYy(yyString, schema && Yy.getSchema(schema)) as any;
  }

  static async read<T extends YySchemaRef>(
    filePath: string,
    schema: T,
  ): Promise<YyDataStrict<T>>;
  static async read(filePath: string): Promise<unknown>;
  static async read<T extends YySchemaRef>(
    filePath: string,
    schema?: T,
  ): Promise<YyDataStrict<T>> {
    try {
      return Yy.parse(await fsp.readFile(filePath, 'utf8'), schema);
    } catch (err) {
      const error = new Error(
        `Error reading file: ${filePath}\n${
          err && err instanceof Error && err.message
        }`,
      );
      error.cause = err;
      throw error;
    }
  }

  /**
   * Synchronous form of {@link Yy.read}.
   */
  static readSync<T extends YySchemaRef>(
    filePath: string,
    schema: T,
  ): YyDataStrict<T>;
  static readSync(filePath: string): unknown;
  static readSync<T extends YySchemaRef>(
    filePath: string,
    schema?: T,
  ): YyDataStrict<T> {
    return Yy.parse(fs.readFileSync(filePath, 'utf8'), schema);
  }

  /**
   * If the file already exists
   * its contents will be read first and the
   * new content will only be written if it
   * is different. This is to reduce file-watcher
   * noise, since excess file-write events can
   * cause problems with GameMaker.
   *
   * If the file already exists, the new file will
   * have its keys sorted to match it (also to
   * reduce file-watcher and Git noise).
   *
   * Calls that result in a no-op because the existing
   * file matches return `false`, while calls that *do*
   * write to disk return `true`.
   */
  static async write<T extends YySchemaRef>(
    filePath: string,
    yyData: YyDataLoose<T>,
    schema: T,
  ): Promise<boolean> {
    let populated = schema ? Yy.populate(yyData, schema) : yyData;
    await fsp.mkdir(path.dirname(filePath), { recursive: true });

    // Only clobber if the target is a file with different
    // contents. This is to prevent file-watcher triggers from
    // creating noise.
    if (await exists(filePath)) {
      // If the existing file is identical, do nothing.
      // (Read it without the schema first, so that we have
      // a record of *key order*).
      const currentRawContent = (await Yy.read(filePath)) as YyDataLoose<T>;
      // Fully parse/populate it so we can compare normalized-to-normalized
      const currentParsedContent = schema
        ? Yy.populate(currentRawContent, schema)
        : currentRawContent;
      if (Yy.areEqual(currentParsedContent, populated)) {
        return false;
      }
      // Sort the keys prior to writing to minimize git noise.
      populated = sortKeysByReference(populated, currentRawContent);
    }
    await fsp.writeFile(filePath, Yy.stringify(populated));
    return true;
  }

  /**
   * Synchronous version of {@link Yy.write}.
   */
  static writeSync<T extends YySchemaRef>(
    filePath: string,
    yyData: YyDataLoose<T>,
    schema: T,
  ): boolean {
    let populated = schema ? Yy.populate(yyData, schema) : yyData;
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    if (existsSync(filePath)) {
      const currentRawContent = Yy.readSync(filePath) as YyDataLoose<T>;
      // Fully parse/populate it so we can compare normalized-to-normalized
      const currentParsedContent = schema
        ? Yy.populate(currentRawContent, schema)
        : currentRawContent;
      if (Yy.areEqual(currentParsedContent, populated)) {
        return false;
      }
      // Sort the keys prior to writing to minimize git noise.
      populated = sortKeysByReference(populated, currentRawContent);
    }
    const stringified = Yy.stringify(populated);
    fs.writeFileSync(filePath, stringified);
    return true;
  }

  static populate<T extends Exclude<YySchemaRef, undefined>>(
    yyData: PartialDeep<YyDataLoose<T>>,
    schema: T,
  ): YyDataStrict<T> {
    const foundSchema = Yy.getSchema(schema);
    return foundSchema.parse(yyData);
  }

  static diff(firstYy: unknown, secondYy: unknown): YyDiff {
    const diff: YyDiff = {};

    function normalize(value: unknown) {
      if (
        value !== null &&
        typeof value === 'object' &&
        Symbol.toPrimitive in value &&
        typeof value[Symbol.toPrimitive] === 'function'
      ) {
        // @ts-expect-error
        value = value[Symbol.toPrimitive]('default');
      }
      return value;
    }

    function recurse(left: unknown, right: unknown, path: string) {
      // Convert to primitives if necessary
      left = normalize(left);
      right = normalize(right);
      if (left === right) {
        return;
      }
      if (left === null || right === null) {
        diff[path] = { left, right };
        return;
      }
      if (Array.isArray(left) && Array.isArray(right)) {
        for (let i = 0; i < Math.max(left.length, right.length); i++) {
          recurse(left[i], right[i], `${path}/${i}`);
        }
        return;
      }
      if (typeof left === 'object' && typeof right === 'object') {
        const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
        for (const key of keys) {
          if (typeof key !== 'string') {
            continue;
          }
          // @ts-expect-error
          recurse(left[key], right[key], `${path}/${key}`);
        }
        return;
      }
      // If we get here, then the values are different.
      diff[path] = { left, right };
      return;
    }

    recurse(firstYy, secondYy, '');
    return diff;
  }

  /**
   * Check for functional equality between two Yy objects.
   */
  static areEqual(firstYy: unknown, secondYy: unknown): boolean {
    if (firstYy != secondYy) {
      if (typeof firstYy !== typeof secondYy) {
        return false;
      }
      // If they are objects/array, then we need to do a deep comparison.
      if (Array.isArray(firstYy) && Array.isArray(secondYy)) {
        if (firstYy.length !== secondYy.length) {
          return false;
        }
        for (let i = 0; i < firstYy.length; i++) {
          if (!Yy.areEqual(firstYy[i], secondYy[i])) {
            return false;
          }
        }
        return true;
      }
      if (
        firstYy &&
        secondYy &&
        typeof firstYy === 'object' &&
        typeof secondYy === 'object'
      ) {
        // If both have primitive versions, compare those
        const asPrimitives = [firstYy, secondYy].map((obj: any) =>
          obj[Symbol.toPrimitive]?.('default'),
        );
        if (
          asPrimitives[0] !== undefined &&
          asPrimitives[1] == asPrimitives[0]
        ) {
          return true;
        }

        const firstKeys = Object.keys(firstYy) as (keyof typeof firstYy)[];
        const secondKeys = Object.keys(secondYy) as (keyof typeof secondYy)[];
        // There could be different number of keys despite functional equality,
        // if any keys have undefined values.
        for (const key of firstKeys) {
          if (!Yy.areEqual(firstYy[key], secondYy[key])) {
            return false;
          }
        }
        for (const key of secondKeys) {
          if (!Yy.areEqual(firstYy[key], secondYy[key])) {
            return false;
          }
        }
        return true;
      }
      return false;
    }
    return true;
  }
}

async function exists(filepath: string) {
  try {
    await fsp.stat(filepath);
    return true;
  } catch {
    return false;
  }
}

function existsSync(filepath: string) {
  try {
    fs.statSync(filepath);
    return true;
  } catch {
    return false;
  }
}
