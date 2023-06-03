import type { IRange, LinePosition } from './project.location.js';

export type Constructor<T = {}> = new (...args: any[]) => T;

export interface Logger {
  (...args: unknown[]): void;
  enabled: boolean;
}

export const log: Logger = Object.assign(
  (...args: unknown[]) => {
    if (log.enabled) {
      console.log(...args);
    }
  },
  { enabled: false },
);

function jsonReplacer(key: string, value: unknown): unknown {
  if (value instanceof Map) {
    const obj: Record<string, unknown> = {};
    for (const [k, v] of value.entries()) {
      obj[k] = v;
    }
    return jsonReplacer(key, obj);
  }
  if (typeof value === 'function' && key === 'toJSON') {
    return jsonReplacer(key, value());
  }
  return value;
}

export function stringify(obj: unknown) {
  return JSON.stringify(obj, jsonReplacer, 2);
}

/**
 * There are multiple ways that Feather/GameMaker accept types to
 * be encoded in strings. To simplify parsing on our end, we normalize
 * them all to a single format. */
export function normalizeTypeString(typeString: string): string {
  typeString = typeString
    .replace(/\[/g, '<')
    .replace(/\]/g, '>')
    .replace(/,|\s+or\s+/gi, '|');
  // Sometimes specific array types are specified with e.g. Array.String
  // instead of Array<String>. Normalize those.
  typeString = typeString.replace(/^Array\.([A-Z][A-Z0-9]*)/gi, 'Array<$1>');
  return typeString;
}

export function isInRange(range: IRange, offset: number | LinePosition) {
  if (typeof offset === 'number') {
    return range.start.offset <= offset && range.end.offset >= offset;
  } else {
    const isSingleLineRange = range.start.line === range.end.line;
    // If we're on the start line, we must be at or after the start column
    if (offset.line === range.start.line) {
      const isAfterStartColumn = offset.column >= range.start.column;
      return (
        isAfterStartColumn &&
        (!isSingleLineRange || offset.column <= range.end.column)
      );
    }
    // If we're on the end line, we must be at or before the end column
    if (offset.line === range.end.line) {
      return offset.column <= range.end.column;
    }
    // If we're on a line in between, we're in range
    if (offset.line > range.start.line && offset.line < range.end.line) {
      return true;
    }
    return false;
  }
}

export function isBeforeRange(range: IRange, offset: number | LinePosition) {
  if (typeof offset === 'number') {
    return offset < range.end.offset;
  } else {
    // If we're before the start line, definitely before the range
    if (offset.line < range.start.line) {
      return true;
    }
    // If we're on the start line, we must be before the start column
    if (offset.line === range.start.line) {
      return offset.column < range.start.column;
    }
    return false;
  }
}
