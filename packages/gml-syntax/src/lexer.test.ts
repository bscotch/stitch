import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { lex } from './lexer.ts';
import { isTrivia, type TokenKind } from './tokens.ts';

/** Significant token kinds (excluding the trailing eof) */
function kinds(source: string): TokenKind[] {
  return lex(source)
    .tokens.filter((t) => !isTrivia(t.kind) && t.kind !== 'eof')
    .map((t) => t.kind);
}

/** Every token as `kind:text`, trivia included */
function all(source: string): string[] {
  return lex(source).tokens.map(
    (t) => `${t.kind}:${source.slice(t.start, t.end)}`,
  );
}

describe('Lexer', function () {
  it('is lossless', function () {
    const source =
      '﻿/// @desc Doc\r\nvar a = $"x{b + 1}y"; // hi\n/* multi\nline */ @\'raw\nstring\' \\\n#region R\n#endregion\n\t';
    const { tokens } = lex(source);
    let at = 0;
    for (const token of tokens) {
      assert.equal(token.start, at, 'tokens must be contiguous');
      at = token.end;
    }
    assert.equal(at, source.length);
  });

  it('distinguishes comment kinds', function () {
    assert.deepEqual(
      all('/// doc\n// line\n//// divider\n/** doc */ /* block */').filter(
        (t) => !t.startsWith('newline') && !t.startsWith('whitespace'),
      ),
      [
        'docLineComment:/// doc',
        'lineComment:// line',
        'lineComment://// divider',
        'docBlockComment:/** doc */',
        'blockComment:/* block */',
        'eof:',
      ],
    );
    // `/**/` is an empty block comment, not a doc comment
    assert.deepEqual(kinds('/**/'), []);
    assert.equal(lex('/**/').tokens[0].kind, 'blockComment');
  });

  it('treats an unterminated block comment as a warning', function () {
    const { tokens, diagnostics } = lex('a = 1;\n/* rest of file\nb = 2;');
    assert.equal(tokens.at(-2)!.kind, 'blockComment');
    assert.equal(diagnostics.length, 1);
    assert.equal(diagnostics[0].severity, 'warning');
  });

  it('lexes keywords and keyword aliases', function () {
    assert.deepEqual(kinds('begin end and or xor not mod div'), [
      '{',
      '}',
      '&&',
      '||',
      '^^',
      '!',
      '%',
      'div',
    ]);
    assert.deepEqual(kinds('constructor function new delete'), [
      'constructor',
      'function',
      'new',
      'delete',
    ]);
    // Words containing keywords are identifiers
    assert.deepEqual(kinds('ifx divide endless'), [
      'identifier',
      'identifier',
      'identifier',
    ]);
  });

  it('lexes numeric literals', function () {
    for (const source of [
      '123',
      '1_000',
      '1.5',
      '.5',
      '1.',
      '0xFF',
      '0xff_ff',
      '$FF00AA',
      '0b1010',
      '#FF00AA',
    ]) {
      assert.deepEqual(all(source), [`number:${source}`, 'eof:'], source);
    }
    // A dot followed by an identifier is an accessor
    assert.deepEqual(kinds('1.x'), ['number', '.', 'identifier']);
  });

  it('lexes strings', function () {
    assert.deepEqual(all('"a\\"b"'), ['string:"a\\"b"', 'eof:']);
    assert.deepEqual(all('@"a\nb"'), ['rawString:@"a\nb"', 'eof:']);
    assert.deepEqual(all("@'a\"b'"), ['rawString:@\'a"b\'', 'eof:']);
    const unterminated = lex('"abc\nx');
    assert.equal(unterminated.diagnostics[0].code, 'unterminated-string');
    assert.equal(unterminated.tokens[0].end, 4, 'stops at the line break');
  });

  it('lexes template strings, including nested braces', function () {
    assert.deepEqual(kinds('$"a{ {b: 1}.b }c"'), [
      'templateStart',
      'templateText',
      'templateExprStart',
      '{',
      'identifier',
      ':',
      'number',
      '}',
      '.',
      'identifier',
      'templateExprEnd',
      'templateText',
      'templateEnd',
    ]);
    // Nested templates
    assert.deepEqual(kinds('$"{$"{x}"}"'), [
      'templateStart',
      'templateExprStart',
      'templateStart',
      'templateExprStart',
      'identifier',
      'templateExprEnd',
      'templateEnd',
      'templateExprEnd',
      'templateEnd',
    ]);
  });

  it('distinguishes accessors from array literals', function () {
    assert.deepEqual(kinds('a[$ "k"]'), ['identifier', '[$', 'string', ']']);
    assert.deepEqual(kinds('a[? k]'), ['identifier', '[?', 'identifier', ']']);
    assert.deepEqual(kinds('a[| 0]'), ['identifier', '[|', 'number', ']']);
    assert.deepEqual(kinds('a[# 0, 1]'), [
      'identifier',
      '[#',
      'number',
      ',',
      'number',
      ']',
    ]);
    assert.deepEqual(kinds('a[@ 0]'), ['identifier', '[@', 'number', ']']);
    // After an operator, `[` starts an array literal
    assert.deepEqual(kinds('x = [$FF, #00FF00]'), [
      'identifier',
      '=',
      '[',
      'number',
      ',',
      'number',
      ']',
    ]);
    // Accessors can follow calls and other accessors
    assert.deepEqual(kinds('f()[$ k]'), [
      'identifier',
      '(',
      ')',
      '[$',
      'identifier',
      ']',
    ]);
  });

  it('marks the end of macro bodies', function () {
    assert.deepEqual(kinds('#macro A 1 + 2\nb = 3'), [
      '#macro',
      'identifier',
      'number',
      '+',
      'number',
      'macroEnd',
      'identifier',
      '=',
      'number',
    ]);
    // Line continuations extend the macro
    assert.deepEqual(kinds('#macro A 1 + \\\n  2\nb'), [
      '#macro',
      'identifier',
      'number',
      '+',
      'number',
      'macroEnd',
      'identifier',
    ]);
    // A comment does not extend the macro
    assert.deepEqual(kinds('#macro A 1 // note\nb'), [
      '#macro',
      'identifier',
      'number',
      'macroEnd',
      'identifier',
    ]);
    // Config-override syntax
    assert.deepEqual(kinds('#macro Android:AD_ID "x"'), [
      '#macro',
      'identifier',
      ':',
      'identifier',
      'string',
      'macroEnd',
    ]);
  });

  it('treats regions and other line-start directives as trivia', function () {
    const source = '#region Name here\n#define legacy\n  #export A, B\n';
    assert.deepEqual(kinds(source), []);
    assert.deepEqual(
      lex(source)
        .tokens.filter((t) => t.kind !== 'newline' && t.kind !== 'eof')
        .map((t) => t.kind),
      ['region', 'directive', 'whitespace', 'directive'],
    );
    // A `#` elsewhere is unexpected
    assert.equal(lex('a = #nope').diagnostics[0].code, 'unexpected-character');
  });

  it('merges consecutive unknown characters into one diagnostic', function () {
    const { tokens, diagnostics } = lex('a = €€€;');
    assert.equal(diagnostics.length, 1);
    assert.equal(tokens.filter((t) => t.kind === 'unknown').length, 1);
  });
});
