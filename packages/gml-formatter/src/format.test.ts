import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { formatGml, GmlFormatError } from './format.ts';
import type { FormatOptions, PresetName } from './options.ts';

type Options = Partial<FormatOptions> & { preset?: PresetName };

/** Format with the given options, asserting idempotency */
function fmt(source: string, options: Options = {}): string {
  const once = formatGml(source, options).text;
  const twice = formatGml(once, options).text;
  assert.equal(twice, once, 'Formatting should be idempotent');
  return once;
}
const lines = (...l: string[]) => l.join('\n');
const bscotch = (source: string, options: Options = {}) =>
  fmt(source, { preset: 'bscotch', ...options });
const standard = (source: string, options: Options = {}) =>
  fmt(source, { preset: 'standard', ...options });

describe('Formatter', function () {
  describe('safety', function () {
    it('refuses to format code with syntax errors', function () {
      assert.throws(() => formatGml('var a = ;'), GmlFormatError);
    });

    it('leaves macros, template strings and raw strings untouched', function () {
      const source = lines(
        '#macro   WEIRD    if(  x  )    \\',
        '      { y=1 }',
        'a = $"{  b+c  }  text";',
        'b = @"  raw',
        '     string ";',
        '',
      );
      assert.equal(standard(source), source);
    });

    it('never merges tokens into different ones', function () {
      assert.equal(standard('a = - -b;'), 'a = - -b;\n');
      assert.equal(standard('a = - --b;'), 'a = - --b;\n');
      assert.equal(standard('a = !!b;'), 'a = !!b;\n');
      assert.equal(standard('delete    x;'), 'delete x;\n');
    });

    it('keeps comments exactly, apart from trailing whitespace', function () {
      const source = lines(
        '/* a',
        '      block   */',
        'x = 1; // trailing   ',
        '/// @desc doc',
        'f();',
      );
      assert.equal(
        bscotch(source),
        lines(
          '/* a',
          '      block   */',
          'x = 1; // trailing',
          '/// @desc doc',
          'f();',
        ),
      );
    });
  });

  describe('whitespace', function () {
    it('removes trailing whitespace and collapses blank lines', function () {
      assert.equal(
        bscotch(lines('a = 1;   ', '\t', '', '', 'b = 2;')),
        lines('a = 1;', '', 'b = 2;'),
      );
    });

    it('preserves line endings and the final newline (bscotch)', function () {
      assert.equal(bscotch('a = 1;\r\nb = 2;\r\n'), 'a = 1;\r\nb = 2;\r\n');
      assert.equal(bscotch('a = 1;'), 'a = 1;');
      assert.equal(standard('a = 1;'), 'a = 1;\n');
    });

    it('never joins or splits statements', function () {
      assert.equal(bscotch('a = 1; b = 2;'), 'a = 1; b = 2;');
      assert.equal(
        bscotch(lines('x = foo(a,', '    b);')),
        lines('x = foo(a,', '    b);'),
      );
    });
  });

  describe('indentation', function () {
    it('uses the file’s dominant indentation', function () {
      const tabs = lines('if a {', '\tb();', '        c();', '\td();', '}');
      assert.equal(
        bscotch(tabs),
        lines('if a {', '\tb();', '\tc();', '\td();', '}'),
      );
      const spaces = lines('if a {', '    b();', '\tc();', '    d();', '}');
      assert.equal(
        bscotch(spaces),
        lines('if a {', '    b();', '    c();', '    d();', '}'),
      );
      const twoSpaces = lines(
        'if a {',
        '  if b {',
        '    c();',
        '      d();',
        '  }',
        '}',
      );
      assert.equal(
        bscotch(twoSpaces),
        lines('if a {', '  if b {', '    c();', '    d();', '  }', '}'),
      );
    });

    it('indents nested blocks, switch cases and unbraced bodies', function () {
      const source = lines(
        'function f() {',
        'switch x {',
        'case 1:',
        'if a',
        'b();',
        'break;',
        'default:',
        'c();',
        '}',
        '}',
      );
      assert.equal(
        bscotch(source, { indentStyle: 'space' }),
        lines(
          'function f() {',
          '    switch x {',
          '        case 1:',
          '            if a',
          '                b();',
          '            break;',
          '        default:',
          '            c();',
          '    }',
          '}',
        ),
      );
    });

    it('indents block contents relative to multi-line headers', function () {
      const source = lines('if a', '    && b {', 'c();', '}');
      assert.equal(
        bscotch(source, { indentStyle: 'space' }),
        lines('if a', '    && b {', '    c();', '}'),
      );
    });

    it('preserves hand-aligned continuation lines (bscotch)', function () {
      const source = lines(
        'function f() {',
        '\treturn make_color(clamp(r, 0, 255),',
        '\t                  clamp(g, 0, 255));',
        '}',
      );
      assert.equal(bscotch(source), source);
    });

    it('normalizes continuation lines (standard)', function () {
      const source = lines(
        'x = foo(a,',
        '                  b);',
        'if a',
        '&& b {',
        '}',
      );
      assert.equal(
        standard(source, { indentStyle: 'space' }),
        lines('x = foo(a,', '    b);', 'if (a', '    && b) {', '}', ''),
      );
    });

    it('preserves directive and comment indentation (bscotch)', function () {
      const source = lines(
        'function f() {',
        '#region Setup',
        '\ta = 1;',
        '\t//if x {',
        '\t\t//b();',
        '\t//}',
        '#endregion',
        '}',
      );
      assert.equal(bscotch(source), source);
      assert.equal(
        standard(source),
        lines(
          'function f() {',
          '\t#region Setup',
          '\ta = 1;',
          '\t//if x {',
          '\t//b();',
          '\t//}',
          '\t#endregion',
          '}',
          '',
        ),
      );
    });
  });

  describe('braces and keywords', function () {
    it('puts `else` on a new line (bscotch) or the same line (standard)', function () {
      const source = lines('if a {', '\tb();', '} else {', '\tc();', '}');
      assert.equal(
        bscotch(source),
        lines('if a {', '\tb();', '}', 'else {', '\tc();', '}'),
      );
      assert.equal(
        standard(lines('if (a) {', '}', 'else {', '}')),
        lines('if (a) {', '} else {', '}', ''),
      );
    });

    it('moves header braces onto the header line', function () {
      assert.equal(
        bscotch(lines('function f()', '{', '\treturn 1;', '}')),
        lines('function f() {', '\treturn 1;', '}'),
      );
      assert.equal(
        bscotch(lines('switch x', '{', '\tcase 1: break;', '}')),
        lines('switch x {', '\tcase 1: break;', '}'),
      );
      // Not when a comment is in the way
      assert.equal(
        bscotch(lines('if a // why', '{', '\tb();', '}')),
        lines('if a // why', '{', '\tb();', '}'),
      );
    });

    it('spaces keyword parens and header braces', function () {
      assert.equal(bscotch('if(a){b();}'), 'if (a) {b();}');
      assert.equal(bscotch('for(i=0;i<1;i++){}'), 'for (i = 0;i < 1;i++) {}');
      assert.equal(bscotch('x = function (){};'), 'x = function() {};');
    });
  });

  describe('insertions', function () {
    it('adds semicolons, except after braces (bscotch)', function () {
      assert.equal(
        bscotch(lines('a = 1', 'f()', 'f = function() {}', 's = {}', 'exit')),
        lines('a = 1;', 'f();', 'f = function() {}', 's = {}', 'exit;'),
      );
      assert.equal(
        standard(lines('f = function() {}', 's = {}')),
        lines('f = function() {};', 's = {};', ''),
      );
    });

    it('does not add semicolons after statement-like macros', function () {
      assert.equal(
        bscotch(lines('IF_DEBUG show();', 'MY_LOOP {', '}')),
        lines('IF_DEBUG show();', 'MY_LOOP {', '}'),
      );
    });

    it('adds condition parentheses (standard)', function () {
      assert.equal(
        standard('if a && b { while c { } } with o x = 1; repeat 3 f();'),
        'if (a && b) { while (c) { } } with (o) x = 1; repeat (3) f();\n',
      );
      assert.equal(standard('if (a) && (b) {}'), 'if ((a) && (b)) {}\n');
    });
  });

  describe('operator spacing', function () {
    it('spaces assignments and comparisons, keeping alignment (bscotch)', function () {
      assert.equal(
        bscotch(lines('a=1;', 'long_name\t= 2;', 'b  = c==d && e<f;')),
        lines('a = 1;', 'long_name\t= 2;', 'b  = c == d && e < f;'),
      );
    });

    it('preserves arithmetic spacing (bscotch) or spaces it (standard)', function () {
      assert.equal(bscotch('a = b*c + d/2;'), 'a = b*c + d/2;');
      assert.equal(standard('a = b*c+d/2;'), 'a = b * c + d / 2;\n');
    });

    it('keeps parameter defaults tight (bscotch)', function () {
      assert.equal(
        bscotch('function f(a, b = 1, c=2) {}'),
        'function f(a, b=1, c=2) {}',
      );
      assert.equal(
        standard('function f(a, b=1) {}'),
        'function f(a, b = 1) {}\n',
      );
    });

    it('formats struct colons and commas', function () {
      assert.equal(bscotch('s = {a:1,b : 2};'), 's = {a : 1, b : 2};');
      assert.equal(standard('s = {a:1,b : 2};'), 's = {a: 1, b: 2};\n');
    });

    it('tightens calls, members, unary operators and separators', function () {
      assert.equal(
        bscotch('x = foo (a , b) . c + ! d ;'),
        'x = foo(a, b).c + !d;',
      );
    });
  });
});
