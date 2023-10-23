import type { Packed } from './Packed.js';
import type { Bschema, Mote } from './types.js';

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

/**
 * Given a Bschema pointer for mote data, resolve the schema definition
 * for that value.
 */
export function resolvePointerInSchema(
  pointer: string | string[],
  mote: Mote,
  packed: Packed,
): Bschema {
  pointer = normalizePointer(pointer);
  const data = resolvePointer(pointer, mote.data);
  let current = packed.getSchema(mote.schema_id);
  for (let i = 0; i < pointer.length; i++) {
    if ('$ref' in current) {
      current = packed.getSchema(current.$ref);
    }
    if ('properties' in current) {
      current = current.properties![pointer[i]];
      continue;
    }
    console.error(
      'Could not resolve pointer',
      pointer,
      'in schema',
      mote.schema_id,
    );
  }
  return current;
}

export function capitalize(str: string) {
  return str[0].toUpperCase() + str.slice(1);
}

export function re(string: string, flags?: string) {
  return new RegExp(string, flags);
}

export function match(
  string: string,
  pattern: string | RegExp,
  flags?: string,
) {
  pattern = typeof pattern === 'string' ? re(pattern, flags) : pattern;
  const match = string.match(pattern);
  return {
    match,
    groups: (match?.groups || {}) as { [key: string]: string | undefined },
  };
}
