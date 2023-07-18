import { logger } from './logger.js';
import type { IRange, LinePosition } from './project.location.js';
import { getTypeOfKind } from './types.checks.js';
import { Type, TypeStore } from './types.js';

export class StitchParserError extends Error {
  constructor(message?: string, assertion?: Function) {
    super(message);
    this.name = 'StitchParserError';
    Error.captureStackTrace(this, assertion || this.constructor);
  }
}

export type Constructor<T = {}> = new (...args: any[]) => T;

export const runningInVscode = !!process.env.VSCODE_IPC_HOOK;

export interface Logger {
  (...args: unknown[]): void;
  enabled: boolean;
}

export const log: Logger = Object.assign(
  (...args: unknown[]) => {
    if (log.enabled) {
      logger.log(...args);
    }
  },
  { enabled: false },
);

export function assert(condition: any, message?: string): asserts condition {
  if (!condition) {
    const err = new StitchParserError(message, assert);
    if (runningInVscode) {
      // VSCode swallows error messages, so we need to log them
      logger.error(err);
    }
    throw err;
  }
}
/** @alias assert */
export const ok: typeof assert = assert;

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
  assert(range !== undefined, 'Range must be defined');
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
  assert(range !== undefined, 'isBeforeRange: Range must be defined');
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

export function isArray<T>(value: unknown): value is T[] | readonly T[] {
  return Array.isArray(value);
}

export function normalizeInferredType(
  type: Type | TypeStore | (Type | TypeStore)[],
) {
  const enumMemberType = getTypeOfKind(type, 'EnumMember');
  if (enumMemberType) {
    const enumMemberSignifier = enumMemberType.signifier;
    const enumType = enumMemberSignifier?.parent;
    if (enumType) {
      return enumType;
    }
  }
  return type;
}
