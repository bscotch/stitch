/**
 * Token kinds and shapes.
 *
 * The lexer is *lossless*: every character of the source belongs to exactly
 * one token, including whitespace and comments ("trivia"). Concatenating the
 * text of every token reproduces the source exactly.
 *
 * Punctuation, operators and keywords use their canonical text as their kind
 * (e.g. `'('`, `'+='`, `'if'`). Keyword aliases map to their canonical kind,
 * so `begin` has kind `'{'`, `and` has kind `'&&'`, etc. Use the token's
 * offsets to recover the original text.
 */

export type TriviaKind =
  /** Byte-order mark at the start of a file */
  | 'bom'
  | 'whitespace'
  /** A single line break (`\n`, `\r\n`, or `\r`) */
  | 'newline'
  /** `// ...` */
  | 'lineComment'
  /** `/* ... *\/` */
  | 'blockComment'
  /** `/// ...` (GML-style doc comment line) */
  | 'docLineComment'
  /** `/** ... *\/` (JS-style doc comment) */
  | 'docBlockComment'
  /** `#region ...` through end of line */
  | 'region'
  /** `#endregion ...` through end of line */
  | 'endregion'
  /**
   * Any other `#name ...` line, e.g. the legacy `#define` (which separates
   * functions in extension GML files) or `#export`. Runs through end of line.
   */
  | 'directive'
  /** A `\` outside of strings, used to continue macro definitions */
  | 'lineContinuation'
  /** Characters the lexer could not make sense of */
  | 'unknown';

export type PunctuationKind =
  | '('
  | ')'
  | '{'
  | '}'
  | '['
  | ']'
  /** `[@` (array mutation accessor) */
  | '[@'
  /** `[?` (ds_map accessor) */
  | '[?'
  /** `[|` (ds_list accessor) */
  | '[|'
  /** `[#` (ds_grid accessor) */
  | '[#'
  /** `[$` (struct accessor) */
  | '[$'
  | ','
  | ';'
  | ':'
  | '?'
  | '.';

export type AssignmentOperatorKind =
  | '='
  | '+='
  | '-='
  | '*='
  | '/='
  | '%='
  | '&='
  | '|='
  | '^='
  | '??=';

export type OperatorKind =
  | '+'
  | '-'
  | '*'
  | '/'
  | '%'
  | 'div'
  | '<<'
  | '>>'
  | '&'
  | '|'
  | '^'
  | '~'
  | '!'
  | '<'
  | '<='
  | '>'
  | '>='
  | '=='
  | '!='
  | '&&'
  | '||'
  | '^^'
  | '??'
  | '++'
  | '--';

export const keywords = [
  'if',
  'then',
  'else',
  'while',
  'do',
  'until',
  'for',
  'repeat',
  'with',
  'switch',
  'case',
  'default',
  'break',
  'continue',
  'exit',
  'return',
  'throw',
  'var',
  'static',
  'globalvar',
  'enum',
  'function',
  'constructor',
  'new',
  'delete',
  'try',
  'catch',
  'finally',
  'true',
  'false',
  'undefined',
  'div',
] as const;
export type KeywordKind = (typeof keywords)[number];

/** Keywords that are aliases for other tokens */
export const keywordAliases = {
  begin: '{',
  end: '}',
  and: '&&',
  or: '||',
  xor: '^^',
  not: '!',
  mod: '%',
} as const satisfies Record<string, TokenKind>;

export type SignificantKind =
  | 'identifier'
  /** Any numeric literal: decimal, hex (`0x`/`$`), binary (`0b`), or color (`#RRGGBB`) */
  | 'number'
  /** `"..."` */
  | 'string'
  /** `@"..."` or `@'...'` */
  | 'rawString'
  /** `$"` */
  | 'templateStart'
  /** Literal text inside a template string */
  | 'templateText'
  /** `{` inside a template string */
  | 'templateExprStart'
  /** `}` closing a template string interpolation */
  | 'templateExprEnd'
  /** `"` closing a template string */
  | 'templateEnd'
  | '#macro'
  /** Zero-width token marking the end of a macro body */
  | 'macroEnd'
  /** Zero-width token at the end of the file */
  | 'eof'
  | PunctuationKind
  | AssignmentOperatorKind
  | OperatorKind
  | KeywordKind;

export type TokenKind = TriviaKind | SignificantKind;

export interface Token {
  kind: TokenKind;
  /** Offset of the first character */
  start: number;
  /** Offset just past the last character */
  end: number;
}

const triviaKinds = new Set<TokenKind>([
  'bom',
  'whitespace',
  'newline',
  'lineComment',
  'blockComment',
  'docLineComment',
  'docBlockComment',
  'region',
  'endregion',
  'directive',
  'lineContinuation',
  'unknown',
] satisfies TriviaKind[]);

export function isTrivia(kind: TokenKind): kind is TriviaKind {
  return triviaKinds.has(kind);
}

export function isComment(kind: TokenKind): boolean {
  return (
    kind === 'lineComment' ||
    kind === 'blockComment' ||
    kind === 'docLineComment' ||
    kind === 'docBlockComment'
  );
}

export function isDocComment(kind: TokenKind): boolean {
  return kind === 'docLineComment' || kind === 'docBlockComment';
}

const assignmentOperators = new Set<TokenKind>([
  '=',
  '+=',
  '-=',
  '*=',
  '/=',
  '%=',
  '&=',
  '|=',
  '^=',
  '??=',
] satisfies AssignmentOperatorKind[]);

export function isAssignmentOperator(
  kind: TokenKind,
): kind is AssignmentOperatorKind {
  return assignmentOperators.has(kind);
}
