import type { Glossary } from '@bscotch/cl2-string-server-shared';
import type { Gcdata } from './GameChanger.js';
import { assert } from './assert.js';
import type { ParsedLineItem, ParsedWord } from './types.editor.js';
import {
  BschemaObject,
  getAdditionalProperties,
  getProperties,
  isBschemaObject,
  type Bschema,
  type BschemaConst,
  type Mote,
} from './types.js';

export function sizeOf(thing: any): number {
  if (!thing) return 0;
  if ('length' in thing && typeof thing.length === 'number')
    return thing.length;
  if ('size' in thing && typeof thing.size === 'number') return thing.size;
  assert(typeof thing === 'object', 'Cannot get size of non-object');
  return Object.keys(thing).length;
}

export function objectToMap<T>(obj: T): Map<keyof T, T[keyof T]> {
  const map = new Map<keyof T, T[keyof T]>();
  for (const key in obj) {
    map.set(key, obj[key]);
  }
  return map;
}

export function normalizePointer(pointer: string | string[]): string[] {
  if (Array.isArray(pointer)) {
    return pointer;
  }
  return pointer.split('/');
}

export function resolvePointer(pointer: string | string[], data: any) {
  pointer = normalizePointer(pointer);
  let current = data;
  for (let i = 0; i < pointer.length; i++) {
    if (typeof current !== 'object') {
      return;
    }
    current = current[pointer[i]];
  }
  return current;
}

function resolveOneOf(schema: Bschema, data: any): Bschema | undefined {
  if (!schema || !('oneOf' in schema) || !('discriminator' in schema)) {
    return schema;
  }
  const dataDescriminator = data[schema.discriminator!.propertyName];
  const possibleMatches: string[] = [];
  const matching = schema.oneOf!.find((subschema) => {
    if (!('properties' in subschema)) {
      return false;
    }
    if (
      !('bConst' in subschema.properties![schema.discriminator!.propertyName])
    ) {
      return false;
    }
    const subschemaDescriminator = (
      subschema.properties![schema.discriminator!.propertyName] as BschemaConst
    ).bConst;
    possibleMatches.push(subschemaDescriminator);
    if (subschemaDescriminator == dataDescriminator) {
      return true;
    }
    return false;
  });
  return matching;
}

/**
 * Set the value at a pointer in a nested object. If a value along
 * the path is missing, it'll be created as an object.
 *
 * Only works with Bschema-style pointers.
 */
export function setValueAtPointer<T>(
  data: T,
  pointer: string | string[],
  value: any,
): T {
  // Ensure that the path to the value exists
  pointer = normalizePointer(pointer);
  let current = data as Record<string, any>;
  for (let i = 0; i < pointer.length; i++) {
    if (i === pointer.length - 1) {
      current[pointer[i]] = value;
    } else if ([undefined, null].includes(current[pointer[i]])) {
      current[pointer[i]] = {};
    } else if (typeof current[pointer[i]] !== 'object') {
      throw new Error(
        `Cannot set intermediate pointer at ${pointer
          .slice(0, i + 1)
          .join(
            '/',
          )}: a non-object value already exists there (${JSON.stringify(
          current[pointer[i]],
        )})`,
      );
    }
    current = current[pointer[i]];
  }
  return data;
}

/**
 * Given a Bschema pointer for mote data, resolve the schema definition
 * for that value.
 */
export function resolvePointerInSchema(
  pointer: string | string[],
  mote: Mote,
  gcData: Gcdata,
  /**
   * For cases where the mote data is incomplete and we need some
   * data to resolve the schema, provide that fallback value here.
   */
  moteFallback?: any,
): Bschema | undefined {
  pointer = normalizePointer(pointer);
  let current = gcData.getSchema(mote.schema_id)!;
  for (let i = 0; i < pointer.length; i++) {
    const currentPointer = pointer.slice(0, i);
    const data =
      resolvePointer(currentPointer, mote.data) ??
      resolvePointer(currentPointer, moteFallback?.data);
    current = normalizeSchema(current, gcData, data);
    if ('properties' in current && current.properties?.[pointer[i]]) {
      current = current.properties![pointer[i]];
      continue;
    }
    if (
      'additionalProperties' in current &&
      typeof current.additionalProperties === 'object'
    ) {
      current = current.additionalProperties;
      continue;
    }
    return undefined;
  }
  return normalizeSchema(current, gcData, resolvePointer(pointer, mote.data));
}

export function normalizeSchema(
  schema: Bschema,
  gcData: Gcdata,
  /** For resolving oneOfs */
  data: any,
): Bschema {
  let overrides: Bschema | undefined;
  if ('$ref' in schema) {
    const refParts = schema.$ref.split('/');
    schema = gcData.getSchema(refParts[0])!;
    assert(schema, `Could not resolve $ref ${refParts[0]}`);
    if (refParts.length > 1) {
      schema = resolvePointer(refParts.slice(1), schema)!;
      assert(schema, `Could not resolve subpointer $ref ${refParts.join('/')}`);
    }
    if ('overrides' in schema) {
      overrides = schema.overrides;
    }
  }
  const oneOf = 'oneOf' in schema ? resolveOneOf(schema, data) : undefined;
  let properties: BschemaObject['properties'] | undefined;
  let additionalProperties: BschemaObject['additionalProperties'] | undefined;
  if (isBschemaObject(oneOf) || isBschemaObject(schema)) {
    properties = {
      ...getProperties(schema),
      ...getProperties(oneOf),
    };
    additionalProperties = {
      ...getAdditionalProperties(schema),
      ...getAdditionalProperties(oneOf),
    } as Bschema | undefined;
    if (!sizeOf(additionalProperties)) additionalProperties = undefined;
  }

  return {
    ...schema,
    properties,
    // @ts-ignore
    additionalProperties,
    oneOf: undefined,
    ...overrides,
  };
}

export function capitalize(str: string) {
  return str[0].toUpperCase() + str.slice(1);
}

/**
 * Given some kind of data object, traverse it to generate all
 * of the terminal pointers through the data.
 * Optionally prefix each pointer with some string.
 */
export function computeTerminalPointers(
  data: any,
  prefixWith?: string,
  collection = new Set<string>(),
  __basePointer: string[] = [],
): Set<string> {
  const addToCollection = () => {
    const pointer = [...__basePointer];
    collection.add(pointer.join('/'));
    return collection;
  };

  __basePointer = prefixWith
    ? [prefixWith, ...__basePointer]
    : [...__basePointer];

  if (typeof data === 'object') {
    for (const key in data) {
      const subdata = data[key];
      computeTerminalPointers(subdata, undefined, collection, [
        ...__basePointer,
        key,
      ]);
    }
  } else {
    addToCollection();
  }
  return collection;
}

/**
 * Get all Bschema-style data pointers defined by a schema.
 */
export function computeMotePointersFromSchema(
  gcData: Gcdata,
  schema: Bschema,
  collection = new Set<string>(),
  withDataPrefix = false,
  __basePointer: string[] = [],
): Set<string> {
  const addToCollection = (final?: string) => {
    const pointer = __basePointer.filter((p) => !p.startsWith('$$'));
    if (final) {
      pointer.push(final);
    }
    collection.add(pointer.join('/'));
    return collection;
  };

  __basePointer = withDataPrefix
    ? ['data', ...__basePointer]
    : [...__basePointer];

  addToCollection();

  if ('$ref' in schema) {
    const subschema = gcData.getSchema(schema.$ref)!;
    const refKey = `$$${schema.$ref}`;
    if (__basePointer.includes(refKey)) {
      __basePointer = [...__basePointer, '*'];
      return addToCollection(`recursion(${schema.$ref})`);
    }
    schema = subschema;
    __basePointer = [...__basePointer, refKey];
  }
  if (isBschemaObject(schema)) {
    for (const key in schema.oneOf || []) {
      computeMotePointersFromSchema(
        gcData,
        schema.oneOf![key],
        collection,
        false,
        __basePointer,
      );
    }
    for (const key in schema.properties) {
      const subSchema = schema.properties[key];
      computeMotePointersFromSchema(gcData, subSchema, collection, false, [
        ...__basePointer,
        key,
      ]);
    }
    if (schema.additionalProperties) {
      computeMotePointersFromSchema(
        gcData,
        schema.additionalProperties,
        collection,
        false,
        [...__basePointer, '*'],
      );
    }
  } else {
    // Then we're at a leaf node and can store it
    // addToCollection();
  }
  return collection;
}

export function isUndefined(value: any): value is undefined {
  return value === undefined;
}

export function isDefined<T>(value: T): value is Exclude<T, undefined> {
  return value !== undefined;
}

export function debugOnError<T extends (...args: any[]) => any>(
  fn: T,
  ...args: Parameters<T>
): ReturnType<T> {
  for (let i = 0; i < 2; i++) {
    try {
      // eslint-disable-next-line no-debugger
      if (i === 1) debugger;
      return fn(...args);
    } catch (e) {
      if (i === 0) {
        console.error(e);
        continue;
      }
      throw e;
    }
  }
  throw new Error('Cannot happen. This is to satisfy the type checker.');
}

export function parsedItemToWords(item: ParsedLineItem): ParsedLineItem[] {
  const words: ParsedLineItem[] = [];
  let currentWordStart = item.start.character;
  let currentWord = '';
  for (let i = 0; i < item.value.length; i++) {
    const char = item.value[i];
    const position = item.start.character + i;
    if (char.match(/[<>()[\].:;|@#,!?"*\s-]/)) {
      // Normalize some stuff to reduce false positives
      currentWord ||= currentWord
        .replace(/'(s|d|ll|ve|re|n)$/, '')
        .replace(/^\d+%?$/, '');
      if (currentWord) {
        // Clean up a bit to allow focusing on the WORDS
        const word = {
          start: { ...item.start },
          end: { ...item.start },
          value: currentWord,
        };
        word.start.character = currentWordStart;
        word.start.index = item.start.index + currentWordStart;
        word.end.character = currentWordStart + currentWord.length;
        word.end.index =
          item.start.index + currentWordStart + currentWord.length;
        currentWord = '';
        words.push(word);
      }
      currentWordStart = position + 1;
    } else {
      currentWord += char;
    }
  }
  return words;
}

export function checkWords(
  item: ParsedLineItem<any> | undefined,
  glossary?: Glossary,
): ParsedWord[] {
  const result: ParsedWord[] = [];
  if (!item || !glossary) return result;
  // Parse out the word positions so they can be used as ranges to check cursor position
  const words = glossary.parse(item.value);
  for (const word of words) {
    const checked = glossary.checkWord(word);
    const asGcWord: ParsedWord = {
      valid: checked.valid,
      value: checked.substr,
      start: { ...item.start },
      end: { ...item.start },
    };
    asGcWord.start.character += checked.start;
    asGcWord.start.index += checked.start;
    asGcWord.end.character = asGcWord.start.character + checked.substr.length;
    asGcWord.end.index = asGcWord.start.index + checked.substr.length;
    result.push(asGcWord);
  }
  return result;
}

export function includes<T>(arr: T[], value: any): value is T {
  return arr.includes(value);
}

export function cleanGameChangerString(str: string | undefined): string {
  return (str || '').replace(/\r?\n/g, ' / ').trim();
}
