/**
 * Parser for JSDoc comments in GML.
 *
 * Supports GameMaker's Feather JSDoc tags (and their aliases), plus Stitch
 * extensions. Comments can be runs of `///` lines or a `/** *\/` block.
 *
 * | Tag | Aliases | Source |
 * |-----|---------|--------|
 * | `@description` | `@desc` | Feather |
 * | `@param {Type} name desc` | `@parameter`, `@arg`, `@argument` | Feather |
 * | `@returns {Type} desc` | `@return` | Feather |
 * | `@function name(args)` | `@func` | Feather |
 * | `@self Type` | `@context` | Feather |
 * | `@url https://...` | | Feather |
 * | `@pure`, `@ignore`, `@deprecated` | | Feather |
 * | `@type {Type} desc` | | Stitch |
 * | `@localvar {Type} name desc` | `@var` | Stitch |
 * | `@globalvar {Type} name desc` | | Stitch |
 * | `@instancevar {Type} name desc` | `@prop`, `@property` | Stitch |
 * | `@template {Constraint} Name` | | Stitch |
 * | `@mixin` | | Stitch |
 * | `@see target` | | Stitch (standard JSDoc) |
 *
 * Inline `{@link target}` / `{@link target|label}` references are found in
 * all descriptions. Any other `@tag` is kept as an `unknown` tag.
 *
 * Everything carries source offsets, so editors can highlight tags, types
 * and names, and resolve links.
 */
import type { SyntaxDiagnostic } from './diagnostics.ts';
import { parseDocType, type DocType, type Span } from './jsdoc.types.ts';
import type { Token } from './tokens.ts';

export type DocTagKind =
  | 'description'
  | 'param'
  | 'returns'
  | 'function'
  | 'self'
  | 'url'
  | 'pure'
  | 'ignore'
  | 'deprecated'
  | 'type'
  | 'localvar'
  | 'globalvar'
  | 'instancevar'
  | 'template'
  | 'mixin'
  | 'see'
  | 'unknown';

const tagAliases: Record<string, DocTagKind> = {
  description: 'description',
  desc: 'description',
  param: 'param',
  parameter: 'param',
  arg: 'param',
  argument: 'param',
  returns: 'returns',
  return: 'returns',
  function: 'function',
  func: 'function',
  self: 'self',
  context: 'self',
  url: 'url',
  pure: 'pure',
  ignore: 'ignore',
  deprecated: 'deprecated',
  type: 'type',
  localvar: 'localvar',
  var: 'localvar',
  globalvar: 'globalvar',
  instancevar: 'instancevar',
  prop: 'instancevar',
  property: 'instancevar',
  template: 'template',
  mixin: 'mixin',
  see: 'see',
};

/** Tags that take a `{Type}` */
const typedTags = new Set<DocTagKind>([
  'param',
  'returns',
  'type',
  'localvar',
  'globalvar',
  'instancevar',
  'template',
]);
/** Tags that take a name after the (optional) type */
const namedTags = new Set<DocTagKind>([
  'param',
  'localvar',
  'globalvar',
  'instancevar',
  'template',
  'function',
]);

/** Free text, with any `{@link}` references found in it */
export interface DocText extends Span {
  /** The text, with comment prefixes removed and lines joined by `\n` */
  text: string;
  links: DocLink[];
}

/** A reference to another symbol (or a URL) */
export interface DocLink extends Span {
  /** The referenced name or URL, as written */
  target: string;
  targetSpan: Span;
  label: string | null;
}

export interface DocName extends Span {
  name: string;
  /** Written as `[name]` or `[name=default]` */
  optional: boolean;
  /** For variadic params written as `...` or `[...]` */
  rest: boolean;
  /** The default value's source text, if given (`[name=default]` or `name=default`) */
  defaultValue: (Span & { text: string }) | null;
}

export interface DocTag extends Span {
  kind: DocTagKind;
  /** The tag name as written, without the `@` */
  tagName: string;
  /** Location of the `@tag` */
  tagSpan: Span;
  /** The parsed type, from `{Type}` (or the bare type for `@self`) */
  type: DocType | null;
  /** Location of the type expression (inside any braces) */
  typeSpan: Span | null;
  name: DocName | null;
  description: DocText | null;
  /**
   * True for a legacy GameMaker script header: a first line like
   * `/// my_function(a, b)` with no tag, treated as `@function`.
   */
  legacy?: boolean;
}

export interface DocComment extends Span {
  /** Text before the first tag */
  description: DocText | null;
  tags: DocTag[];
  diagnostics: SyntaxDiagnostic[];
}

interface DocLine {
  /** Line content, with the comment prefix removed */
  text: string;
  /** Source offset of the first character of `text` */
  start: number;
}

/**
 * Parse a doc comment, given its tokens: a run of `///` line comments or a
 * single `/** *\/` block (e.g. as returned by `leadingDocComments`).
 */
export function parseDocComment(text: string, tokens: Token[]): DocComment {
  const lines = tokens.flatMap((token) => docLines(text, token));
  const doc: DocComment = {
    start: tokens[0]?.start ?? 0,
    end: tokens.at(-1)?.end ?? 0,
    description: null,
    tags: [],
    diagnostics: [],
  };
  /** Where continuation lines get appended */
  let describing: { description: DocText | null } = doc;

  for (const [i, line] of lines.entries()) {
    const cursor = new Cursor(text, line, doc.diagnostics);
    cursor.skipSpace();
    if (cursor.peek() === '@' && /\w/.test(cursor.peek(1))) {
      const tag = parseTag(cursor);
      doc.tags.push(tag);
      describing = tag;
      continue;
    }
    if (i === 0 && !doc.tags.length) {
      const legacy = parseLegacyHeader(cursor);
      if (legacy) {
        doc.tags.push(legacy);
        describing = legacy;
        continue;
      }
    }
    const rest = cursor.rest();
    if (rest.text) {
      describing.description = appendText(describing.description, rest);
    }
  }
  reportDuplicateParams(doc);
  return doc;
}

/** Strip comment syntax, returning each line's content with its offset */
function docLines(text: string, token: Token): DocLine[] {
  if (token.kind === 'docLineComment') {
    return [
      { text: text.slice(token.start + 3, token.end), start: token.start + 3 },
    ];
  }
  // Block comment: strip `/**`, `*/`, and any leading ` * ` on each line
  const terminated =
    text.startsWith('*/', token.end - 2) && token.end - token.start >= 5;
  const innerEnd = terminated ? token.end - 2 : token.end;
  const lines: DocLine[] = [];
  let lineStart = token.start + 3;
  const lineBreak = /\r\n|\r|\n/g;
  lineBreak.lastIndex = lineStart;
  while (lineStart <= innerEnd) {
    const match = lineBreak.exec(text);
    const lineEnd = match && match.index < innerEnd ? match.index : innerEnd;
    const content = text.slice(lineStart, lineEnd);
    const prefix = /^\s*\*(?!\/)\s?/.exec(content)?.[0] ?? '';
    lines.push({
      text: content.slice(prefix.length),
      start: lineStart + prefix.length,
    });
    if (lineEnd === innerEnd) break;
    lineStart = lineEnd + match![0].length;
  }
  return lines;
}

function parseTag(cursor: Cursor): DocTag {
  const tagStart = cursor.offset;
  cursor.advance(1);
  const tagName = cursor.readWhile(/[\w]/);
  const kind = tagAliases[tagName] ?? 'unknown';
  const tag: DocTag = {
    kind,
    tagName,
    tagSpan: { start: tagStart, end: cursor.offset },
    start: tagStart,
    end: cursor.lineEnd,
    type: null,
    typeSpan: null,
    name: null,
    description: null,
  };
  cursor.skipSpace();

  if (kind === 'self') {
    // `@self Type` takes a bare type. Tolerate (but flag) braces.
    let braced = false;
    if (cursor.peek() === '{') {
      braced = true;
      cursor.error(
        'jsdoc-unexpected-braces',
        '@self types should not be wrapped in braces',
        cursor.offset,
        cursor.offset + 1,
      );
      cursor.advance(1);
      cursor.skipSpace();
    }
    const typeStart = cursor.offset;
    cursor.readWhile(braced ? /[^\s}]/ : /\S/);
    if (cursor.offset > typeStart) {
      setType(tag, cursor, typeStart, cursor.offset);
    } else {
      cursor.error(
        'jsdoc-expected-name',
        'Expected a type',
        typeStart,
        typeStart,
      );
    }
    if (braced) {
      cursor.skipSpace();
      if (cursor.peek() === '}') cursor.advance(1);
    }
  } else if (typedTags.has(kind) || kind === 'unknown') {
    if (cursor.peek() === '{') readBracedType(tag, cursor);
  }

  if (namedTags.has(kind)) {
    cursor.skipSpace();
    tag.name =
      kind === 'function' ? readFunctionName(cursor) : readName(cursor);
    if (!tag.name && kind !== 'function') {
      cursor.error(
        'jsdoc-expected-name',
        `Expected a name for @${tagName}`,
        cursor.offset,
        cursor.offset,
      );
    }
  }

  // Everything else is description, optionally after a ` - ` separator
  cursor.skipSpace();
  if (cursor.peek() === '-' && /\s/.test(cursor.peek(1) || ' ')) {
    cursor.advance(1);
  }
  const rest = cursor.rest();
  if (rest.text) {
    tag.description = appendText(null, rest);
    if (kind === 'see' && !tag.description.links.length) {
      // A bare `@see target` is itself a link
      const target = /^\S+/.exec(rest.text)![0];
      tag.description.links.push({
        target,
        targetSpan: { start: rest.start, end: rest.start + target.length },
        label: null,
        start: rest.start,
        end: rest.start + target.length,
      });
    }
  }
  return tag;
}

/** `{Type}`, which may be unterminated or contain nested braces */
function readBracedType(tag: DocTag, cursor: Cursor) {
  const open = cursor.offset;
  const close = findClosingBrace(cursor.remaining());
  cursor.advance(1);
  const contentStart = cursor.offset;
  if (close === -1) {
    // Assume the type is the first word, so that the rest of the tag
    // (e.g. a param name) can still be parsed.
    cursor.readWhile(/\S/);
    cursor.error('jsdoc-unterminated', `Expected '}'`, open, cursor.offset);
    setType(tag, cursor, contentStart, cursor.offset);
    return;
  }
  cursor.advance(close - 1);
  const contentEnd = cursor.offset;
  cursor.advance(1);
  setType(tag, cursor, contentStart, contentEnd);
}

/** Index of the `}` matching the `{` at the start of `text`, or -1 */
function findClosingBrace(text: string): number {
  let depth = 0;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '{') depth++;
    else if (text[i] === '}' && --depth === 0) return i;
  }
  return -1;
}

function setType(tag: DocTag, cursor: Cursor, start: number, end: number) {
  const { type, diagnostics } = parseDocType(cursor.source, start, end);
  tag.type = type;
  tag.typeSpan = { start, end };
  cursor.diagnostics.push(...diagnostics);
}

/** `name`, `name=default`, `[name]`, `[name=default]`, `...` or `[...]` */
function readName(cursor: Cursor): DocName | null {
  const start = cursor.offset;
  const optional = cursor.peek() === '[';
  if (optional) {
    cursor.advance(1);
    cursor.skipSpace();
  }
  const nameStart = cursor.offset;
  const rest = cursor.peek() === '.' && cursor.startsWith('...');
  if (rest) cursor.advance(3);
  else cursor.readWhile(/\w/);
  if (cursor.offset === nameStart) return null;
  const name = cursor.source.slice(nameStart, cursor.offset);
  // `name...` is also a rest param
  let isRest = rest;
  if (!rest && cursor.startsWith('...')) {
    cursor.advance(3);
    isRest = true;
  }

  let defaultValue: DocName['defaultValue'] = null;
  if (optional) {
    cursor.skipSpace();
    if (cursor.peek() === '=') {
      cursor.advance(1);
      const valueStart = cursor.offset;
      while (!cursor.done && cursor.peek() !== ']') cursor.advance(1);
      defaultValue = trimmedSpan(cursor.source, valueStart, cursor.offset);
    }
    if (cursor.peek() === ']') {
      cursor.advance(1);
    } else {
      cursor.error('jsdoc-unterminated', `Expected ']'`, start, cursor.offset);
    }
  } else if (cursor.peek() === '=') {
    // `name=default`, with no spaces
    cursor.advance(1);
    const valueStart = cursor.offset;
    cursor.readWhile(/\S/);
    defaultValue = trimmedSpan(cursor.source, valueStart, cursor.offset);
  }
  return {
    name,
    start,
    end: cursor.offset,
    optional: optional || !!defaultValue,
    rest: isRest,
    defaultValue,
  };
}

/** `@function name(args)`: the name, skipping over the signature */
function readFunctionName(cursor: Cursor): DocName | null {
  const start = cursor.offset;
  cursor.readWhile(/\w/);
  if (cursor.offset === start) return null;
  const name: DocName = {
    name: cursor.source.slice(start, cursor.offset),
    start,
    end: cursor.offset,
    optional: false,
    rest: false,
    defaultValue: null,
  };
  if (cursor.peek() === '(') {
    const close = cursor.indexOf(')');
    if (close !== -1) cursor.advance(close - cursor.offset + 1);
  }
  return name;
}

/** A legacy script header line, like `/// my_function(a, b)` */
function parseLegacyHeader(cursor: Cursor): DocTag | null {
  const match = /^([A-Za-z_]\w*)\s*\([^)]*\)\s*$/.exec(cursor.remaining());
  if (!match) return null;
  const start = cursor.offset;
  const name = readFunctionName(cursor)!;
  return {
    kind: 'function',
    tagName: '',
    tagSpan: { start, end: start },
    start,
    end: cursor.lineEnd,
    type: null,
    typeSpan: null,
    name,
    description: null,
    legacy: true,
  };
}

function trimmedSpan(source: string, start: number, end: number) {
  while (start < end && /\s/.test(source[start])) start++;
  while (end > start && /\s/.test(source[end - 1])) end--;
  return start < end ? { text: source.slice(start, end), start, end } : null;
}

const linkPattern =
  /\{@link(?:code|plain)?\s+([^\s|}]+)(?:\s*\|\s*|\s+)?([^}]*)\}/g;

function appendText(
  existing: DocText | null,
  addition: { text: string; start: number; end: number },
): DocText {
  const links: DocLink[] = [];
  for (const match of addition.text.matchAll(linkPattern)) {
    const start = addition.start + match.index;
    const targetStart = start + match[0].indexOf(match[1], 6);
    links.push({
      target: match[1],
      targetSpan: { start: targetStart, end: targetStart + match[1].length },
      label: match[2]?.trim() || null,
      start,
      end: start + match[0].length,
    });
  }
  if (!existing) return { ...addition, links };
  existing.text += `\n${addition.text}`;
  existing.end = addition.end;
  existing.links.push(...links);
  return existing;
}

function reportDuplicateParams(doc: DocComment) {
  const seen = new Set<string>();
  for (const tag of doc.tags) {
    if (tag.kind !== 'param' || !tag.name || tag.name.rest) continue;
    if (seen.has(tag.name.name)) {
      doc.diagnostics.push({
        code: 'jsdoc-duplicate-param',
        message: `Duplicate param '${tag.name.name}'`,
        severity: 'warning',
        start: tag.name.start,
        end: tag.name.end,
      });
    }
    seen.add(tag.name.name);
  }
}

/** Reads through one line of a doc comment, tracking source offsets */
class Cursor {
  protected pos = 0;
  /** The full source text. Each line's content is a contiguous slice of it. */
  readonly source: string;
  readonly line: DocLine;
  readonly diagnostics: SyntaxDiagnostic[];

  constructor(source: string, line: DocLine, diagnostics: SyntaxDiagnostic[]) {
    this.source = source;
    this.line = line;
    this.diagnostics = diagnostics;
  }
  get offset() {
    return this.line.start + this.pos;
  }
  get lineEnd() {
    return this.line.start + trimEnd(this.line.text).length;
  }
  get done() {
    return this.pos >= this.line.text.length;
  }
  peek(ahead = 0) {
    return this.line.text[this.pos + ahead] ?? '';
  }
  startsWith(text: string) {
    return this.line.text.startsWith(text, this.pos);
  }
  indexOf(text: string) {
    const index = this.line.text.indexOf(text, this.pos);
    return index === -1 ? -1 : this.line.start + index;
  }
  advance(count: number) {
    this.pos = Math.min(this.pos + count, this.line.text.length);
  }
  readWhile(pattern: RegExp): string {
    const start = this.pos;
    while (!this.done && pattern.test(this.line.text[this.pos])) this.pos++;
    return this.line.text.slice(start, this.pos);
  }
  skipSpace() {
    this.readWhile(/\s/);
  }
  /** The rest of the line, without consuming it */
  remaining(): string {
    return this.line.text.slice(this.pos);
  }
  /** The rest of the line, trimmed, with its source location */
  rest(): { text: string; start: number; end: number } {
    const text = this.line.text.slice(this.pos);
    const leading = text.length - text.trimStart().length;
    const trimmed = text.trim();
    const start = this.offset + leading;
    this.pos = this.line.text.length;
    return { text: trimmed, start, end: start + trimmed.length };
  }
  error(
    code: SyntaxDiagnostic['code'],
    message: string,
    start: number,
    end: number,
  ) {
    this.diagnostics.push({ code, message, severity: 'warning', start, end });
  }
}

function trimEnd(text: string) {
  return text.replace(/\s+$/, '');
}
