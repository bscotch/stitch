/**
 * Parser for Feather type expressions, as used in JSDoc tags like
 * `@param {Array<Real>|Undefined} name`.
 *
 * Feather accepts a few equivalent syntaxes, all of which are supported:
 * - Unions with `,` (Feather's documented separator), `|`, or `OR`.
 * - Type arguments with `<>` (documented) or `[]`, e.g. `Array[Real]`.
 *
 * Names are dotted paths (`Asset.GMObject`, `Struct.Player`,
 * `Id.Instance.o_player`). Resolving them is up to the analysis layer.
 * Note that Feather's *base* type names are case-insensitive
 * (`string` == `String`) while specifiers are case-sensitive.
 */
import type { SyntaxDiagnostic } from './diagnostics.ts';

export interface Span {
  start: number;
  end: number;
}

export type DocType = DocNamedType | DocUnionType | DocLiteralType;

/** A (possibly dotted, possibly parameterized) type name */
export interface DocNamedType extends Span {
  kind: 'named';
  /** The full dotted name, exactly as written (e.g. `Asset.GMObject`) */
  name: string;
  /** Each dot-separated part of the name, with its location */
  path: (Span & { name: string })[];
  /** Type arguments, e.g. `Real` in `Array<Real>` */
  args: DocType[];
}

/** A string literal type, e.g. `"left"` in `{"left"|"right"}` */
export interface DocLiteralType extends Span {
  kind: 'literal';
  /** The literal as written, including quotes */
  raw: string;
}

export interface DocUnionType extends Span {
  kind: 'union';
  types: DocType[];
}

export interface DocTypeParseResult {
  /** The parsed type, or null if the expression was empty */
  type: DocType | null;
  diagnostics: SyntaxDiagnostic[];
}

/**
 * Parse a Feather type expression.
 *
 * @param text The full source text
 * @param start Offset of the start of the type expression in `text`
 * @param end Offset just past the end of the type expression
 */
export function parseDocType(
  text: string,
  start = 0,
  end = text.length,
): DocTypeParseResult {
  const parser = new TypeParser(text, start, end);
  return { type: parser.parse(), diagnostics: parser.diagnostics };
}

/** Normalized string form, using `|` for unions and `<>` for type arguments */
export function formatDocType(type: DocType): string {
  if (type.kind === 'union') return type.types.map(formatDocType).join('|');
  if (type.kind === 'literal') return type.raw;
  if (!type.args.length) return type.name;
  return `${type.name}<${type.args.map(formatDocType).join('|')}>`;
}

/** Every named type in the expression (including type arguments), in order */
export function flattenDocType(type: DocType): DocNamedType[] {
  if (type.kind === 'union') return type.types.flatMap(flattenDocType);
  if (type.kind === 'literal') return [];
  return [type, ...type.args.flatMap(flattenDocType)];
}

const closers: Record<string, string> = { '<': '>', '[': ']' };

class TypeParser {
  readonly diagnostics: SyntaxDiagnostic[] = [];
  protected pos: number;
  protected readonly text: string;
  protected readonly end: number;

  constructor(text: string, start: number, end: number) {
    this.text = text;
    this.pos = start;
    this.end = end;
  }

  parse(): DocType | null {
    this.skipSpace();
    if (this.pos >= this.end) return null;
    // A common mistake is wrapping the whole type in brackets, e.g.
    // `<String|Real>`. Report it, but parse the contents.
    const opener = this.text[this.pos];
    if (closers[opener]) {
      this.error(
        'Type arguments must follow a type name',
        this.pos,
        this.pos + 1,
      );
      this.pos++;
      const type = this.parseUnion(closers[opener]);
      this.skipSpace();
      if (this.text[this.pos] === closers[opener]) this.pos++;
      this.finish();
      return type;
    }
    const type = this.parseUnion();
    this.finish();
    return type;
  }

  /** Report anything left over */
  protected finish() {
    this.skipSpace();
    if (this.pos < this.end) {
      this.error(
        `Unexpected '${this.text.slice(this.pos, this.end).trim()}' in type`,
        this.pos,
        this.end,
      );
      this.pos = this.end;
    }
  }

  protected parseUnion(closer?: string): DocType | null {
    const types: DocType[] = [];
    while (true) {
      this.skipSpace();
      const type = this.parseMember(closer);
      if (type) types.push(type);
      this.skipSpace();
      if (!this.eatSeparator()) break;
    }
    if (!types.length) return null;
    if (types.length === 1) return types[0];
    return {
      kind: 'union',
      start: types[0].start,
      end: types.at(-1)!.end,
      types,
    };
  }

  protected eatSeparator(): boolean {
    const c = this.text[this.pos];
    if (c === '|' || c === ',') {
      this.pos++;
      return true;
    }
    const word = /^(OR|or)\b/.exec(this.text.slice(this.pos, this.end));
    if (word) {
      this.pos += word[0].length;
      return true;
    }
    return false;
  }

  /** A union member: a name or literal, with any `[]` array suffixes */
  protected parseMember(closer?: string): DocType | null {
    let type: DocType | null = this.parseLiteral() ?? this.parseNamed(closer);
    // JSDoc-style `T[]` means `Array<T>`
    while (type && this.text.startsWith('[]', this.pos)) {
      const suffixStart = this.pos;
      this.pos += 2;
      type = {
        kind: 'named',
        start: type.start,
        end: this.pos,
        name: 'Array',
        path: [{ name: 'Array', start: suffixStart, end: this.pos }],
        args: [type],
      };
    }
    return type;
  }

  protected parseLiteral(): DocLiteralType | null {
    const quote = this.text[this.pos];
    if (quote !== '"' && quote !== "'") return null;
    const start = this.pos;
    const close = this.text.indexOf(quote, start + 1);
    if (close === -1 || close >= this.end) {
      this.error('Unterminated string', start, this.end);
      this.pos = this.end;
      return null;
    }
    this.pos = close + 1;
    return {
      kind: 'literal',
      start,
      end: this.pos,
      raw: this.text.slice(start, this.pos),
    };
  }

  protected parseNamed(closer?: string): DocNamedType | null {
    const start = this.pos;
    // `*` is the standard JSDoc "any" type
    if (this.text[this.pos] === '*') {
      this.pos++;
      return {
        kind: 'named',
        start,
        end: this.pos,
        name: '*',
        path: [{ name: '*', start, end: this.pos }],
        args: [],
      };
    }
    const path: DocNamedType['path'] = [];
    while (true) {
      const partStart = this.pos;
      while (this.pos < this.end && /[\w$]/.test(this.text[this.pos])) {
        this.pos++;
      }
      if (this.pos === partStart) {
        if (path.length || this.text[this.pos] !== closer) {
          this.error('Expected a type name', this.pos, this.pos + 1);
        }
        break;
      }
      path.push({
        name: this.text.slice(partStart, this.pos),
        start: partStart,
        end: this.pos,
      });
      if (this.text[this.pos] !== '.') break;
      this.pos++;
    }
    if (!path.length) {
      // Skip a character to guarantee progress, unless it's a closer
      // or separator that an outer loop will handle.
      if (
        this.pos < this.end &&
        this.text[this.pos] !== closer &&
        !/[|,]/.test(this.text[this.pos])
      ) {
        this.pos++;
      }
      return null;
    }
    const type: DocNamedType = {
      kind: 'named',
      start,
      end: this.pos,
      name: this.text.slice(start, this.pos),
      path,
      args: [],
    };
    this.skipSpace();
    const opener = this.text[this.pos];
    if (closers[opener] && !this.text.startsWith('[]', this.pos)) {
      this.pos++;
      const args = this.parseUnion(closers[opener]);
      if (args) type.args.push(args);
      this.skipSpace();
      if (this.text[this.pos] === closers[opener]) {
        this.pos++;
      } else {
        this.error(`Expected '${closers[opener]}'`, this.pos, this.pos);
      }
      type.end = this.pos;
    }
    return type;
  }

  protected skipSpace() {
    while (this.pos < this.end && /\s/.test(this.text[this.pos])) this.pos++;
  }

  protected error(message: string, start: number, end: number) {
    this.diagnostics.push({
      code: 'jsdoc-invalid-type',
      message,
      severity: 'warning',
      start,
      end: Math.min(end, this.end),
    });
  }
}
