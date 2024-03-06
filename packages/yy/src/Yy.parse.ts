/**
 * @file Modified from public domain code: https://github.com/sidorares/json-bigint/blob/master/lib/parse.js
 */

import { Schema, z } from 'zod';

const suspectProtoRx =
  /(?:_|\\u005[Ff])(?:_|\\u005[Ff])(?:p|\\u0070)(?:r|\\u0072)(?:o|\\u006[Ff])(?:t|\\u0074)(?:o|\\u006[Ff])(?:_|\\u005[Ff])(?:_|\\u005[Ff])/;
const suspectConstructorRx =
  /(?:c|\\u0063)(?:o|\\u006[Ff])(?:n|\\u006[Ee])(?:s|\\u0073)(?:t|\\u0074)(?:r|\\u0072)(?:u|\\u0075)(?:c|\\u0063)(?:t|\\u0074)(?:o|\\u006[Ff])(?:r|\\u0072)/;

const escapee = {
  '"': '"',
  '\\': '\\',
  '/': '/',
  b: '\b',
  f: '\f',
  n: '\n',
  r: '\r',
  t: '\t',
};

export function parseYy<T extends Schema | undefined>(
  source: string,
  schema?: T,
): T extends Schema ? z.infer<T> : unknown {
  // Clear trailing commas
  source = source.replace(/,(\s*[}\]])/g, '$1');

  /** Index of the current character */
  let at = 0;
  /** The current character */
  let ch = ' ';
  const text = source;

  function error(m: string): never {
    throw {
      name: 'SyntaxError',
      message: m,
      at: at,
      text: text,
    };
  }

  function next(c?: string) {
    // If a c parameter is provided, verify that it matches the current character.

    if (c && c !== ch) {
      error("Expected '" + c + "' instead of '" + ch + "'");
    }

    // Get the next character. When there are no more characters,
    // return the empty string.

    ch = text.charAt(at);
    at += 1;
    return ch;
  }

  function number() {
    // Parse a number value.

    let str = '';

    if (ch === '-') {
      str = '-';
      next('-');
    }
    while (ch >= '0' && ch <= '9') {
      str += ch;
      next();
    }
    if (ch === '.') {
      str += '.';
      while (next() && ch >= '0' && ch <= '9') {
        str += ch;
      }
    }
    if (ch === 'e' || ch === 'E') {
      str += ch;
      next();
      if (ch === ('-' as string) || ch === ('+' as string)) {
        str += ch;
        next();
      }
      while (ch >= '0' && ch <= '9') {
        str += ch;
        next();
      }
    }
    // Store as a BigInt if
    // 1. it's an integer, and
    // 2. it's too big to store as a vanilla number.
    // (BigInts can only be parsed from purely-numeric strings)
    const num = +str;
    if (!str.match(/[.E]/)) {
      const asBigInt = BigInt(str);
      if (asBigInt > Number.MAX_SAFE_INTEGER) {
        return asBigInt;
      }
    }
    return num;
  }

  function string(): string {
    // Parse a string value.

    let hex,
      i,
      string = '',
      uffff;

    // When parsing for string values, we must look for " and \ characters.

    if (ch === '"') {
      let startAt = at;
      while (next()) {
        if (ch === '"') {
          if (at - 1 > startAt) string += text.substring(startAt, at - 1);
          next();
          return string;
        }
        if (ch === '\\') {
          if (at - 1 > startAt) string += text.substring(startAt, at - 1);
          next();
          if (ch === 'u') {
            uffff = 0;
            for (i = 0; i < 4; i += 1) {
              hex = parseInt(next(), 16);
              if (!isFinite(hex)) {
                break;
              }
              uffff = uffff * 16 + hex;
            }
            string += String.fromCharCode(uffff);
          } else if (typeof escapee[ch] === 'string') {
            string += escapee[ch];
          } else {
            break;
          }
          startAt = at;
        }
      }
    }
    error('Bad string');
  }

  function white() {
    // Skip whitespace.
    while (ch && ch <= ' ') {
      next();
    }
  }

  function word() {
    // true, false, or null.

    switch (ch) {
      case 't':
        next('t');
        next('r');
        next('u');
        next('e');
        return true;
      case 'f':
        next('f');
        next('a');
        next('l');
        next('s');
        next('e');
        return false;
      case 'n':
        next('n');
        next('u');
        next('l');
        next('l');
        return null;
    }
    error("Unexpected '" + ch + "'");
  }

  function value(): any {
    // Parse a JSON value. It could be an object, an array, a string, a number,
    // or a word.

    white();
    switch (ch) {
      case '{':
        return object();
      case '[':
        return array();
      case '"':
        return string();
      case '-':
        return number();
      default:
        return ch >= '0' && ch <= '9' ? number() : word();
    }
  }

  function array(): any[] | void {
    // Parse an array value.

    const array: any[] = [];

    if (ch === '[') {
      next('[');
      white();
      if (ch === (']' as string)) {
        next(']');
        return array; // empty array
      }
      while (ch) {
        array.push(value());
        white();
        if (ch === (']' as string)) {
          next(']');
          return array;
        }
        next(',');
        white();
      }
    }
    error('Bad array');
  }

  function object() {
    // Parse an object value.

    let key: string;
    const obj = {} as Record<string | symbol, any>;

    /**
     * In 2024, GameMaker started using a new format,
     * where `resourceType` is replaced with a key
     * `${ResourceType}` (whose value is the version for that type).
     * To simplify downstream use, we'll normalize by adding
     * a common resourcetype key via the `yyResourceTypeSymbol`,
     * and note the format while we're at it using the
     * `yyFormatSymbol` key.
     */

    if (ch === '{') {
      next('{');
      white();
      if (ch === ('}' as string)) {
        next('}');
        return obj; // empty object
      }
      while (ch) {
        key = string();
        white();
        next(':');

        if (suspectProtoRx.test(key) === true) {
          error('Object contains forbidden prototype property');
        } else if (suspectConstructorRx.test(key) === true) {
          error('Object contains forbidden constructor property');
        } else {
          obj[key] = value();
        }

        white();
        if (ch === ('}' as string)) {
          next('}');
          return obj;
        }
        next(',');
        white();
      }
    }
    error('Bad object');
  }

  const result = value();
  white();
  if (ch) {
    error('Syntax error');
  }

  return schema ? schema.parse(result) : result;
}
