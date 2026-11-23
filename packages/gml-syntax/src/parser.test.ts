import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type * as Ast from './ast.ts';
import { leadingDocComments } from './docs.ts';
import { LineIndex } from './lineIndex.ts';
import { parse } from './parser.ts';
import { parseExpression, sexpr } from './test.lib.ts';
import { nodePathAt } from './walk.ts';

function expr(source: string): string {
  const { expression, parsed } = parseExpression(source);
  assert.deepEqual(parsed.diagnostics, [], `Diagnostics for: ${source}`);
  return sexpr(expression);
}

/** Parse a program that must have no diagnostics, returning its statements */
function statements(source: string): Ast.Statement[] {
  const parsed = parse(source);
  assert.deepEqual(parsed.diagnostics, [], `Diagnostics for: ${source}`);
  return parsed.ast.body;
}

function only<T extends Ast.Statement['kind']>(
  source: string,
  kind: T,
): Extract<Ast.Statement, { kind: T }> {
  const body = statements(source);
  assert.equal(body.length, 1, `Expected one statement in: ${source}`);
  assert.equal(body[0].kind, kind);
  return body[0] as Extract<Ast.Statement, { kind: T }>;
}

describe('Parser', function () {
  describe('expressions', function () {
    it('respects arithmetic precedence and associativity', function () {
      assert.equal(expr('1 + 2 * 3'), '(1 + (2 * 3))');
      assert.equal(expr('1 - 2 - 3'), '((1 - 2) - 3)');
      assert.equal(expr('a div b mod c'), '((a div b) % c)');
      assert.equal(expr('-a * b'), '((- a) * b)');
      assert.equal(expr('(1 + 2) * 3'), '([(1 + 2)] * 3)');
    });

    it('binds bitwise operators tighter than comparisons', function () {
      assert.equal(expr('a & b == c'), '((a & b) == c)');
      assert.equal(expr('a | b ^ c & d'), '(a | (b ^ (c & d)))');
      assert.equal(expr('a << 1 + b'), '(a << (1 + b))');
    });

    it('handles logical, nullish and conditional operators', function () {
      assert.equal(expr('a || b && c'), '(a || (b && c))');
      assert.equal(expr('a and b or not c'), '((a && b) || (! c))');
      assert.equal(expr('a ?? b || c'), '(a ?? (b || c))');
      assert.equal(expr('a ? b : c ? d : e'), '(a ? b : (c ? d : e))');
      assert.equal(expr('a > 1 ? b + 1 : c'), '((a > 1) ? (b + 1) : c)');
    });

    it('treats `=` inside expressions as equality', function () {
      assert.equal(expr('a = b'), '(a = b)');
      const statement = only('if (a = b) { c = 1; }', 'IfStatement');
      assert.equal(sexpr(statement.test), '[(a = b)]');
    });

    it('parses accessor chains and calls', function () {
      assert.equal(
        expr('a.b[0][$ "k"][? k][| 1][# 1, 2][@ 3].c()'),
        'a.b[array 0][struct "k"][map k][list 1][grid 1, 2][arrayMutate 3].c()',
      );
      assert.equal(expr('arr[1, 2]'), 'arr[array 1, 2]');
      assert.equal(expr('f(a)(b).c'), 'f(a)(b).c');
      assert.equal(expr('global.thing'), 'global.thing');
    });

    it('supports omitted and trailing arguments', function () {
      assert.equal(expr('f(a,,c)'), 'f(a, _, c)');
      assert.equal(expr('f(,b)'), 'f(_, b)');
      assert.equal(expr('f(a, b,)'), 'f(a, b)');
    });

    it('parses prefix and postfix updates', function () {
      assert.equal(expr('a++ + ++b'), '((a++) + (++b))');
      assert.equal(expr('-a--'), '(- (a--))');
    });

    it('parses literals', function () {
      assert.equal(expr('[1, "two", true, undefined,]'), '[1, "two", true, undefined]');
      assert.equal(
        expr('{ a: 1, "b": 2, c, d: function () {} }'),
        '{a: 1, "b": 2, c: ∅, d: function ()}',
      );
      assert.equal(expr('$"x{a + 1}y"'), '$"x{(a + 1)}y"');
      assert.equal(expr('@"multi\nline"'), '@"multi\nline"');
    });

    it('parses new expressions', function () {
      assert.equal(expr('new Foo(1, 2)'), 'new Foo(1, 2)');
      assert.equal(expr('new global.Ns.Foo()'), 'new global.Ns.Foo()');
      assert.equal(expr('new Foo().bar()'), 'new Foo().bar()');
    });

    it('parses function expressions anywhere an expression can go', function () {
      assert.equal(
        expr('array_map(arr, function (x) { return x * 2; })'),
        'array_map(arr, function (x))',
      );
    });
  });

  describe('statements', function () {
    it('distinguishes assignments from expression statements', function () {
      const [assign, compound, call, update] = statements(
        'a.b[0] = 1; x += 2; f(); i++;',
      );
      assert.equal(assign.kind, 'Assignment');
      assert.equal(sexpr(assign), 'a.b[array 0] = 1');
      assert.equal(compound.kind, 'Assignment');
      assert.equal((compound as Ast.Assignment).operator, '+=');
      assert.equal(call.kind, 'ExpressionStatement');
      assert.equal(update.kind, 'ExpressionStatement');
    });

    it('parses chained `=` as assignment of a comparison', function () {
      assert.equal(sexpr(only('a = b = c', 'Assignment')), 'a = (b = c)');
    });

    it('reports invalid assignment targets', function () {
      const parsed = parse('f() = 1;');
      assert.equal(parsed.diagnostics[0]?.code, 'invalid-assignment-target');
    });

    it('does not require semicolons or line breaks', function () {
      const body = statements('a = 1 b = 2 c()');
      assert.deepEqual(
        body.map((s) => s.kind),
        ['Assignment', 'Assignment', 'ExpressionStatement'],
      );
      // Postfix ++ does not continue across a line break
      const [first, second] = statements('a = b\n++c');
      assert.equal(sexpr(first), 'a = b');
      assert.equal(sexpr(second), '(++c)');
    });

    it('parses variable declarations', function () {
      const local = only('var a = 1, b, c = a + 1;', 'VariableDeclaration');
      assert.equal(local.keyword, 'var');
      assert.deepEqual(
        local.declarators.map((d) => [d.name.name, sexpr(d.init)]),
        [
          ['a', '1'],
          ['b', '∅'],
          ['c', '(a + 1)'],
        ],
      );
      assert.equal(only('static s = 0;', 'VariableDeclaration').keyword, 'static');
      const globals = only('globalvar g1, g2;', 'VariableDeclaration');
      assert.deepEqual(
        globals.declarators.map((d) => d.name.name),
        ['g1', 'g2'],
      );
    });

    it('parses control flow', function () {
      const ifElse = only('if a then b() else if c { d() } else e()', 'IfStatement');
      assert.equal(ifElse.alternate?.kind, 'IfStatement');
      only('while (i < 10) i++;', 'WhileStatement');
      only('do { i++ } until i > 10;', 'DoUntilStatement');
      only('repeat 3 { f() }', 'RepeatStatement');
      only('with (other) instance_destroy();', 'WithStatement');
      const loop = only('for (var i = 0; i < 10; i += 1) {}', 'ForStatement');
      assert.equal(loop.init?.kind, 'VariableDeclaration');
      assert.equal(loop.update?.kind, 'Assignment');
      const empty = only('for (;;) break;', 'ForStatement');
      assert.equal(empty.init, null);
      assert.equal(empty.test, null);
      assert.equal(empty.update, null);
    });

    it('parses begin/end as blocks', function () {
      const block = only('begin a = 1; end', 'Block');
      assert.equal(block.body.length, 1);
    });

    it('parses switch statements', function () {
      const statement = only(
        'switch (x) { case 1: case 2: f(); break; default: g(); }',
        'SwitchStatement',
      );
      assert.deepEqual(
        statement.cases.map((c) => [sexpr(c.test), c.body.length]),
        [
          ['1', 0],
          ['2', 2],
          ['∅', 1],
        ],
      );
    });

    it('parses try/catch/finally and throw', function () {
      const statement = only(
        'try { throw "oops"; } catch (e) { show_debug_message(e); } finally { cleanup(); }',
        'TryStatement',
      );
      assert.equal(statement.handler?.param?.name, 'e');
      assert.ok(statement.finalizer);
      assert.equal(statement.block.body[0].kind, 'ThrowStatement');
    });

    it('parses return, exit, break and continue', function () {
      const [value, bare, exit] = statements(
        'return a + 1; return; exit;',
      );
      assert.equal(sexpr((value as Ast.ReturnStatement).argument), '(a + 1)');
      assert.equal((bare as Ast.ReturnStatement).argument, null);
      assert.equal(exit.kind, 'ExitStatement');
    });

    it('parses function declarations and constructors', function () {
      const fn = only('function add(a, b = 1) { return a + b; }', 'FunctionDeclaration');
      assert.equal(fn.name.name, 'add');
      assert.deepEqual(
        fn.params.map((p) => [p.name.name, sexpr(p.defaultValue)]),
        [
          ['a', '∅'],
          ['b', '1'],
        ],
      );
      assert.equal(fn.isConstructor, false);

      const ctor = only(
        'function Child(x) : Parent(x, 2) constructor { y = x; }',
        'FunctionDeclaration',
      );
      assert.equal(ctor.isConstructor, true);
      assert.equal(ctor.parent?.name.name, 'Parent');
      assert.equal(ctor.parent?.args.length, 2);
    });

    it('parses immediately-invoked function expressions', function () {
      const statement = only('(function () { a = 1; })();', 'ExpressionStatement');
      assert.equal(statement.expression.kind, 'CallExpression');
      const call = statement.expression as Ast.CallExpression;
      assert.equal(call.callee.kind, 'ParenthesizedExpression');
      // Also as an assignment value
      assert.equal(
        sexpr(only('x = (function () { return 1; })();', 'Assignment')),
        'x = [function ()]()',
      );
    });

    it('allows extraneous braces and semicolons', function () {
      const body = statements('{ { a = 1; } };\n;;\nfunction f() {};\n{}');
      assert.deepEqual(
        body.map((s) => s.kind),
        [
          'Block',
          'EmptyStatement',
          'EmptyStatement',
          'EmptyStatement',
          'FunctionDeclaration',
          'Block',
        ],
      );
    });

    it('parses enums with expression values', function () {
      const statement = only(
        'enum Color { red, green = 5, blue = Color.green + 1, flag = 1 << 3, neg = -1, }',
        'EnumDeclaration',
      );
      assert.equal(statement.name.name, 'Color');
      assert.deepEqual(
        statement.members.map((m) => [m.name.name, sexpr(m.init)]),
        [
          ['red', '∅'],
          ['green', '5'],
          ['blue', '(Color.green + 1)'],
          ['flag', '(1 << 3)'],
          ['neg', '(- 1)'],
        ],
      );
    });
  });

  describe('macros', function () {
    it('parses expression bodies', function () {
      const [macro, after] = statements('#macro TAU (pi * 2)\nx = TAU');
      assert.equal(macro.kind, 'MacroDeclaration');
      const m = macro as Ast.MacroDeclaration;
      assert.equal(m.name.name, 'TAU');
      assert.equal(m.config, null);
      assert.equal(sexpr(m.body), '[(pi * 2)]');
      assert.equal(after.kind, 'Assignment');
    });

    it('parses configuration overrides', function () {
      const [base, android] = statements(
        '#macro AD_ID ""\n#macro Android:AD_ID "com.example.game"',
      ) as Ast.MacroDeclaration[];
      assert.equal(base.config, null);
      assert.equal(android.config?.name, 'Android');
      assert.equal(android.name.name, 'AD_ID');
      assert.equal(sexpr(android.body), '"com.example.game"');
    });

    it('keeps non-expression bodies as raw source', function () {
      const source = '#macro LOOP for (var i = 0; i < 10; i++)\nLOOP { }';
      const parsed = parse(source);
      const macro = parsed.ast.body[0] as Ast.MacroDeclaration;
      assert.equal(macro.body, null);
      assert.equal(
        source.slice(macro.bodyStart, macro.bodyEnd),
        'for (var i = 0; i < 10; i++)',
      );
      // The macro body's errors are not reported, though its *usage* is
      // not valid GML syntax without expansion
      assert.ok(parsed.diagnostics.every((d) => d.start > macro.end));
    });

    it('supports multi-line macros and empty bodies', function () {
      const [multi, empty] = statements(
        '#macro SUM 1 + \\\n  2\n#macro EMPTY\n',
      ) as Ast.MacroDeclaration[];
      assert.equal(sexpr(multi.body), '(1 + 2)');
      assert.equal(empty.body, null);
      assert.equal(empty.bodyStart, empty.bodyEnd);
    });
  });

  describe('error recovery', function () {
    it('always produces a complete tree', function () {
      const parsed = parse('var a = SurpriseEnum.;\nb = 2;');
      assert.equal(parsed.diagnostics[0].code, 'expected-identifier');
      // Parsing continues after the error
      assert.equal(parsed.ast.body.at(-1)?.kind, 'Assignment');
    });

    it('merges runs of unexpected tokens into one error', function () {
      const parsed = parse('a = 1; ) ] } b = 2;');
      const errors = parsed.ast.body.filter((s) => s.kind === 'ErrorStatement');
      assert.equal(errors.length, 1);
      assert.equal(parsed.diagnostics.length, 1);
      assert.equal(parsed.ast.body.at(-1)?.kind, 'Assignment');
    });

    it('recovers from unclosed blocks and calls', function () {
      const parsed = parse('function f() {\n  g(1, 2\n}\nh();');
      assert.ok(parsed.diagnostics.length > 0);
      assert.equal(parsed.ast.body[0].kind, 'FunctionDeclaration');
    });
  });

  describe('utilities', function () {
    it('finds doc comments preceding a node', function () {
      const source = [
        '/// @desc Not attached (blank line follows)',
        '',
        '/// @param {Real} a',
        '/// @returns {Real}',
        'function f(a) { return a; }',
        '/** @type {Real} */',
        'var x = 1;',
        '// regular comment breaks the association',
        'var y = 2;',
      ].join('\n');
      const parsed = parse(source);
      const [fn, x, y] = parsed.ast.body;
      const text = (node: Ast.Statement) =>
        leadingDocComments(parsed, node).map((t) =>
          source.slice(t.start, t.end),
        );
      assert.deepEqual(text(fn), ['/// @param {Real} a', '/// @returns {Real}']);
      assert.deepEqual(text(x), ['/** @type {Real} */']);
      assert.deepEqual(text(y), []);
    });

    it('finds the node path at an offset', function () {
      const source = 'x = foo.bar(1);';
      const parsed = parse(source);
      const path = nodePathAt(parsed.ast, source.indexOf('bar') + 1);
      assert.deepEqual(
        path.map((n) => n.kind),
        [
          'Program',
          'Assignment',
          'CallExpression',
          'MemberExpression',
          'Identifier',
        ],
      );
    });

    it('converts between offsets and line positions', function () {
      const index = new LineIndex('ab\r\ncd\ne');
      assert.deepEqual(index.positionAt(0), { line: 0, character: 0 });
      assert.deepEqual(index.positionAt(4), { line: 1, character: 0 });
      assert.deepEqual(index.positionAt(7), { line: 2, character: 0 });
      assert.deepEqual(index.positionAt(8), { line: 2, character: 1 });
      assert.equal(index.offsetAt({ line: 1, character: 1 }), 5);
      // Characters past the end of a line clamp to the line's end
      assert.equal(index.offsetAt({ line: 0, character: 99 }), 2);
      assert.equal(index.lineCount, 3);
    });
  });
});
