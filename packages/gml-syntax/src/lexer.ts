import type { SyntaxDiagnostic } from './diagnostics.ts';
import {
  isTrivia,
  keywordAliases,
  keywords,
  type Token,
  type TokenKind,
} from './tokens.ts';

export interface LexResult {
  /** Every token in the source, including trivia, in order. */
  tokens: Token[];
  diagnostics: SyntaxDiagnostic[];
}

const keywordKinds = new Map<string, TokenKind>([
  ...keywords.map((k) => [k, k] as const),
  ...Object.entries(keywordAliases),
]);

/** Operators and punctuation, longest first so the first match wins */
const operators = [
  '??=',
  '<<',
  '>>',
  '<=',
  '>=',
  '==',
  '!=',
  '+=',
  '-=',
  '*=',
  '/=',
  '%=',
  '&=',
  '|=',
  '^=',
  '??',
  '&&',
  '||',
  '^^',
  '++',
  '--',
  '+',
  '-',
  '*',
  '/',
  '%',
  '<',
  '>',
  '=',
  '!',
  '&',
  '|',
  '^',
  '~',
  ',',
  ';',
  ':',
  '?',
  '.',
  '(',
  ')',
  '[',
  ']',
] as const satisfies TokenKind[];

/**
 * Kinds that can end an expression. A `[` directly following one of these
 * is an accessor (so `[$`, `[?` etc. are accessor openers). Otherwise `[`
 * starts an array literal, whose first element could start with `$` (hex),
 * `#` (color), and so on.
 */
const expressionEnders = new Set<TokenKind>([
  'identifier',
  'number',
  'string',
  'rawString',
  'templateEnd',
  ')',
  ']',
  'true',
  'false',
  'undefined',
]);

const accessorOpeners: Record<string, TokenKind> = {
  '@': '[@',
  '?': '[?',
  '|': '[|',
  '#': '[#',
  $: '[$',
};

function isDigit(code: number) {
  return code >= 48 && code <= 57;
}
function isHexDigit(code: number) {
  return (
    isDigit(code) || (code >= 65 && code <= 70) || (code >= 97 && code <= 102)
  );
}
function isIdentStart(code: number) {
  return (
    (code >= 65 && code <= 90) || (code >= 97 && code <= 122) || code === 95
  );
}
function isIdentPart(code: number) {
  return isIdentStart(code) || isDigit(code);
}
function isNewline(code: number) {
  return code === 10 || code === 13;
}
function isHorizontalSpace(code: number) {
  return code === 32 || code === 9 || code === 11 || code === 12;
}

type Mode = { kind: 'template' } | { kind: 'templateExpr'; depth: number };

/** Split GML source into a lossless token stream. */
export function lex(text: string): LexResult {
  const tokens: Token[] = [];
  const diagnostics: SyntaxDiagnostic[] = [];
  const modes: Mode[] = [];
  let pos = 0;
  let inMacro = false;
  let lastSignificant: TokenKind | undefined;

  const code = (at: number) => text.charCodeAt(at);
  const push = (kind: TokenKind, start: number, end: number) => {
    tokens.push({ kind, start, end });
    if (!isTrivia(kind)) {
      lastSignificant = kind;
    }
  };
  const error = (
    diagnostic: Omit<SyntaxDiagnostic, 'severity'>,
    severity: SyntaxDiagnostic['severity'] = 'error',
  ) => {
    diagnostics.push({ ...diagnostic, severity });
  };
  const readToLineEnd = (from: number) => {
    let at = from;
    while (at < text.length && !isNewline(code(at))) at++;
    return at;
  };
  const unknown = (start: number, end: number) => {
    const prev = tokens.at(-1);
    if (prev?.kind === 'unknown' && prev.end === start) {
      // Merge with the previous unknown token and its diagnostic
      prev.end = end;
      diagnostics.at(-1)!.end = end;
      return;
    }
    push('unknown', start, end);
    error({
      code: 'unexpected-character',
      message: `Unexpected character(s)`,
      start,
      end,
    });
  };

  if (code(0) === 0xfeff) {
    push('bom', 0, 1);
    pos = 1;
  }

  while (pos < text.length) {
    const start = pos;
    const mode = modes.at(-1);

    // TEMPLATE STRING CONTENT
    if (mode?.kind === 'template') {
      const c = code(pos);
      if (c === 34 /* " */) {
        push('templateEnd', pos, ++pos);
        modes.pop();
      } else if (c === 123 /* { */) {
        push('templateExprStart', pos, ++pos);
        modes.push({ kind: 'templateExpr', depth: 0 });
      } else if (isNewline(c)) {
        error({
          code: 'unterminated-template',
          message: 'Unterminated template string',
          start: pos,
          end: pos,
        });
        modes.pop();
      } else {
        while (pos < text.length) {
          const c = code(pos);
          if (c === 34 || c === 123 || isNewline(c)) break;
          if (c === 92 /* \ */ && pos + 1 < text.length) {
            pos += isNewline(code(pos + 1)) ? 1 : 2;
          } else {
            pos++;
          }
        }
        push('templateText', start, pos);
      }
      continue;
    }

    // CODE
    const c = code(pos);

    // Newlines (and the end of macro bodies)
    if (isNewline(c)) {
      if (inMacro && !macroIsContinued(tokens)) {
        push('macroEnd', pos, pos);
        inMacro = false;
      }
      pos += c === 13 && code(pos + 1) === 10 ? 2 : 1;
      push('newline', start, pos);
      continue;
    }

    if (isHorizontalSpace(c)) {
      while (pos < text.length && isHorizontalSpace(code(pos))) pos++;
      push('whitespace', start, pos);
      continue;
    }

    if (isIdentStart(c)) {
      while (pos < text.length && isIdentPart(code(pos))) pos++;
      const word = text.slice(start, pos);
      push(keywordKinds.get(word) ?? 'identifier', start, pos);
      continue;
    }

    if (isDigit(c) || (c === 46 /* . */ && isDigit(code(pos + 1)))) {
      pos = readNumber(text, pos);
      push('number', start, pos);
      continue;
    }

    switch (c) {
      case 34 /* " */: {
        pos++;
        let terminated = false;
        while (pos < text.length) {
          const c = code(pos);
          if (c === 34) {
            pos++;
            terminated = true;
            break;
          }
          if (isNewline(c)) break;
          if (c === 92 /* \ */ && !isNewline(code(pos + 1))) pos++;
          pos++;
        }
        pos = Math.min(pos, text.length);
        push('string', start, pos);
        if (!terminated) {
          error({
            code: 'unterminated-string',
            message: 'Unterminated string',
            start,
            end: pos,
          });
        }
        continue;
      }
      case 64 /* @ */: {
        const quote = code(pos + 1);
        if (quote === 34 || quote === 39 /* ' */) {
          const end = text.indexOf(quote === 34 ? '"' : "'", pos + 2);
          pos = end === -1 ? text.length : end + 1;
          push('rawString', start, pos);
          if (end === -1) {
            error({
              code: 'unterminated-string',
              message: 'Unterminated string',
              start,
              end: pos,
            });
          }
        } else {
          unknown(start, ++pos);
        }
        continue;
      }
      case 36 /* $ */: {
        const next = code(pos + 1);
        if (next === 34) {
          pos += 2;
          push('templateStart', start, pos);
          modes.push({ kind: 'template' });
        } else if (isHexDigit(next)) {
          pos++;
          while (
            pos < text.length &&
            (isHexDigit(code(pos)) || code(pos) === 95)
          ) {
            pos++;
          }
          push('number', start, pos);
        } else {
          unknown(start, ++pos);
        }
        continue;
      }
      case 35 /* # */: {
        const wordEnd = scanWhile(text, pos + 1, isIdentPart);
        const word = text.slice(pos + 1, wordEnd);
        if (word === 'macro') {
          pos = wordEnd;
          push('#macro', start, pos);
          inMacro = true;
        } else if (word === 'region' || word === 'endregion') {
          pos = readToLineEnd(wordEnd);
          push(word, start, pos);
        } else if (word.length === 6 && /^[0-9a-fA-F]{6}$/.test(word)) {
          pos = wordEnd;
          push('number', start, pos);
        } else if (word && isAtLineStart(text, start)) {
          pos = readToLineEnd(wordEnd);
          push('directive', start, pos);
        } else {
          pos = Math.max(wordEnd, pos + 1);
          unknown(start, pos);
        }
        continue;
      }
      case 47 /* / */: {
        const next = code(pos + 1);
        if (next === 47) {
          pos = readToLineEnd(pos);
          // Exactly three slashes is a doc comment. Four or more is
          // typically a visual divider, so it's a regular comment.
          const isDoc = code(start + 2) === 47 && code(start + 3) !== 47;
          push(isDoc ? 'docLineComment' : 'lineComment', start, pos);
          continue;
        }
        if (next === 42 /* * */) {
          const isDoc = code(pos + 2) === 42 && code(pos + 3) !== 47;
          const end = text.indexOf('*/', pos + 2);
          pos = end === -1 ? text.length : end + 2;
          push(isDoc ? 'docBlockComment' : 'blockComment', start, pos);
          if (end === -1) {
            // GameMaker allows this, treating the rest of the file as a
            // comment, but it's usually a mistake.
            error(
              {
                code: 'unterminated-comment',
                message: 'Unterminated block comment',
                start,
                end: pos,
              },
              'warning',
            );
          }
          continue;
        }
        break;
      }
      case 92 /* \ */: {
        push('lineContinuation', start, ++pos);
        continue;
      }
      case 123 /* { */: {
        if (mode?.kind === 'templateExpr') mode.depth++;
        push('{', start, ++pos);
        continue;
      }
      case 125 /* } */: {
        if (mode?.kind === 'templateExpr') {
          if (mode.depth === 0) {
            push('templateExprEnd', start, ++pos);
            modes.pop();
            continue;
          }
          mode.depth--;
        }
        push('}', start, ++pos);
        continue;
      }
      case 91 /* [ */: {
        const opener =
          lastSignificant && expressionEnders.has(lastSignificant)
            ? accessorOpeners[text[pos + 1]]
            : undefined;
        if (opener) {
          pos += 2;
          push(opener, start, pos);
        } else {
          push('[', start, ++pos);
        }
        continue;
      }
    }

    // Operators and punctuation
    const op = operators.find((op) => text.startsWith(op, pos));
    if (op) {
      pos += op.length;
      push(op, start, pos);
      continue;
    }

    // Anything else is unexpected. Keep surrogate pairs together.
    pos += c >= 0xd800 && c <= 0xdbff ? 2 : 1;
    unknown(start, pos);
  }

  if (modes.some((m) => m.kind === 'template')) {
    error({
      code: 'unterminated-template',
      message: 'Unterminated template string',
      start: text.length,
      end: text.length,
    });
  }
  if (inMacro) push('macroEnd', text.length, text.length);
  push('eof', text.length, text.length);
  return { tokens, diagnostics };
}

/** Whether only horizontal whitespace precedes `offset` on its line */
function isAtLineStart(text: string, offset: number) {
  for (let i = offset - 1; i >= 0; i--) {
    const c = text.charCodeAt(i);
    if (isNewline(c)) return true;
    if (!isHorizontalSpace(c)) return false;
  }
  return true;
}

/** Whether the most recent non-whitespace token is a line continuation */
function macroIsContinued(tokens: Token[]) {
  for (let i = tokens.length - 1; i >= 0; i--) {
    const kind = tokens[i].kind;
    if (kind === 'whitespace') continue;
    return kind === 'lineContinuation';
  }
  return false;
}

function scanWhile(text: string, from: number, test: (c: number) => boolean) {
  let at = from;
  while (at < text.length && test(text.charCodeAt(at))) at++;
  return at;
}

function readNumber(text: string, start: number): number {
  const c = text.charCodeAt(start);
  const next = text[start + 1];
  if (c === 48 /* 0 */ && (next === 'x' || next === 'X')) {
    if (isHexDigit(text.charCodeAt(start + 2))) {
      return scanWhile(text, start + 2, (c) => isHexDigit(c) || c === 95);
    }
  }
  if (c === 48 /* 0 */ && (next === 'b' || next === 'B')) {
    const d = text.charCodeAt(start + 2);
    if (d === 48 || d === 49) {
      return scanWhile(text, start + 2, (c) => c === 48 || c === 49 || c === 95);
    }
  }
  const isDecimalPart = (c: number) => isDigit(c) || c === 95;
  let at = scanWhile(text, start, isDecimalPart);
  if (text.charCodeAt(at) === 46 /* . */ && at > start) {
    // Only treat the dot as a decimal point if it is followed by a digit,
    // or by nothing identifier-like (e.g. `1.`). Otherwise it's an accessor.
    const after = text.charCodeAt(at + 1);
    if (isDigit(after) || !isIdentStart(after)) {
      at = scanWhile(text, at + 1, isDecimalPart);
    }
  } else if (text.charCodeAt(at) === 46 && at === start) {
    // Leading-dot decimal like `.5`
    at = scanWhile(text, at + 1, isDecimalPart);
  }
  return at;
}
