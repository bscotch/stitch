import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { fileDiagnostics } from './diagnostics.ts';
import { analyzeFiles, sourceFileFor, getNatives } from './test.lib.ts';
import { GmlAnalyzer } from './analyzer.ts';
import { formatUnion } from './types.ts';

const codes = (
  p: Awaited<ReturnType<typeof analyzeFiles>>,
  file: string,
  options = {},
) => fileDiagnostics(p.analyzer, file, options).map((d) => d.code);

describe('Analysis', function () {
  describe('natives', function () {
    it('resolves native functions, with generic return types', async function () {
      const p = await analyzeFiles({
        'scripts/A':
          'var list = [1, 2];\nvar last = array_pop(list);\nshow_debug_message(last);',
      });
      assert.equal(p.symbolAt('scripts/A', 'array_pop')?.native, 'Base');
      assert.equal(p.typeAt('scripts/A', 'var list'), 'Array<Real>');
      assert.equal(p.typeAt('scripts/A', 'var last'), 'Real');
    });

    it('records argument ranges for signature help', async function () {
      const p = await analyzeFiles({ 'scripts/A': 'draw_text(1, 2, "hi");' });
      const arg = p.queries.argumentAt('scripts/A', p.at('scripts/A', '"hi"'));
      assert.equal(arg?.idx, 2);
      assert.equal(p.queries.parameterFor(arg!)?.name, 'string');
    });
  });

  describe('globals', function () {
    it('resolves functions, macros and enums across files', async function () {
      const p = await analyzeFiles({
        'scripts/Lib': [
          '#macro LIMIT 10',
          'enum Color { red, green }',
          '/// @param {Real} n',
          '/// @returns {String}',
          'function describe(n) { return string(n); }',
        ].join('\n'),
        'scripts/Use': 'var s = describe(LIMIT);\nvar c = Color.green;',
      });
      assert.equal(
        p.defAt('scripts/Use', 'describe'),
        p.declaration('scripts/Lib', 'describe'),
      );
      assert.equal(p.typeAt('scripts/Use', 'var s'), 'String');
      assert.equal(p.typeAt('scripts/Use', 'LIMIT'), 'Real');
      assert.equal(
        p.symbolAt('scripts/Use', 'Color.green')?.kind,
        'enumMember',
      );
      assert.equal(p.typeAt('scripts/Use', 'var c'), 'Enum.Color');
    });

    it('treats function declarations in script blocks as global', async function () {
      const p = await analyzeFiles({
        'scripts/A': 'if (true) {\n  function nested() {}\n}',
        'scripts/B': 'nested();',
      });
      assert.equal(p.symbolAt('scripts/B', 'nested')?.kind, 'function');
    });

    it('declares globals with globalvar, global.x and @globalvar', async function () {
      const p = await analyzeFiles({
        'scripts/A':
          'globalvar G1;\nG1 = 1;\nglobal.g2 = "two";\n/// @globalvar {Bool} G3',
        'scripts/B': 'var a = G1;\nvar b = global.g2;\nvar c = G3;',
      });
      assert.equal(p.typeAt('scripts/B', 'G1'), 'Real');
      assert.equal(p.typeAt('scripts/B', 'g2'), 'String');
      assert.equal(p.typeAt('scripts/B', 'G3'), 'Bool');
      assert.deepEqual(codes(p, 'scripts/B'), []);
    });
  });

  describe('objects', function () {
    it('inherits variables from parents, without shadowing them', async function () {
      const p = await analyzeFiles(
        {
          'objects/o_parent/Create_0': 'hp = 10;',
          'objects/o_child/Create_0':
            'event_inherited();\nhp = 20;\nspeed = 3;',
          'objects/o_child/Step_0': 'hp -= 1;',
        },
        { assets: [{ name: 'o_child', kind: 'objects', parent: 'o_parent' }] },
      );
      const def = p.declaration('objects/o_parent/Create_0', 'hp');
      assert.equal(p.defAt('objects/o_child/Create_0', 'hp'), def);
      assert.equal(p.defAt('objects/o_child/Step_0', 'hp'), def);
      // Native instance variables aren't redeclared
      assert.equal(
        p.symbolAt('objects/o_child/Create_0', 'speed')?.native,
        'Base',
      );
    });

    it("doesn't inherit variables without event_inherited()", async function () {
      const p = await analyzeFiles(
        {
          'objects/o_parent/Create_0': 'hp = 10;',
          'objects/o_child/Create_0': 'mana = 1;',
          'objects/o_child/Step_0': 'show_debug_message(hp);',
        },
        { assets: [{ name: 'o_child', kind: 'objects', parent: 'o_parent' }] },
      );
      assert.ok(
        codes(p, 'objects/o_child/Step_0').includes('undeclared-variable'),
      );
    });

    it('resolves variables of other objects, with `with` and dot access', async function () {
      const p = await analyzeFiles({
        'objects/o_enemy/Create_0': 'hp = 3;',
        'scripts/A': 'with (o_enemy) {\n  hp = 0;\n}\nvar h = o_enemy.hp;',
      });
      const def = p.declaration('objects/o_enemy/Create_0', 'hp');
      assert.equal(p.defAt('scripts/A', 'hp'), def);
      assert.equal(p.defAt('scripts/A', 'o_enemy.hp'), def);
    });

    it('gives `other` the colliding object in collision events', async function () {
      const p = await analyzeFiles({
        'objects/o_wall/Create_0': 'solid_level = 1;',
        'objects/o_player/Collision_o_wall': 'var s = other.solid_level;',
      });
      assert.equal(
        p.defAt('objects/o_player/Collision_o_wall', 'solid_level'),
        p.declaration('objects/o_wall/Create_0', 'solid_level'),
      );
    });
  });

  describe('constructors and structs', function () {
    it('resolves members of constructed structs, including inherited ones', async function () {
      const p = await analyzeFiles({
        'scripts/Shapes': [
          'function Shape() constructor {',
          '  static count = 0;',
          '  name = "";',
          '}',
          'function Circle(r) : Shape() constructor {',
          '  radius = r;',
          '}',
        ].join('\n'),
        'scripts/Use':
          'var c = new Circle(1);\nvar n = c.name;\nvar r = c.radius;',
      });
      assert.equal(p.typeAt('scripts/Use', 'var c'), 'Struct.Circle');
      assert.equal(
        p.defAt('scripts/Use', 'c.name'),
        p.declaration('scripts/Shapes', 'name ='),
      );
      assert.equal(p.typeAt('scripts/Use', 'var n'), 'String');
      assert.ok(p.symbolAt('scripts/Shapes', 'count')?.static);
    });

    it('declares struct literal members at the literal', async function () {
      const p = await analyzeFiles({
        'scripts/A': 'var s = { a: 1, b: "x" };\ns.a = 2;\nvar b = s.b;',
      });
      assert.equal(
        p.defAt('scripts/A', 's.a'),
        p.declaration('scripts/A', 'a:'),
      );
      assert.equal(p.typeAt('scripts/A', 'var b'), 'String');
    });

    it('binds `self` with method()', async function () {
      const p = await analyzeFiles({
        'scripts/A':
          'var s = { v: 1 };\nvar f = method(s, function() { return v; });',
      });
      assert.equal(
        p.defAt('scripts/A', 'return v'),
        p.declaration('scripts/A', 'v:'),
      );
    });

    it('adds mixin variables to the caller', async function () {
      const p = await analyzeFiles({
        'scripts/Mix':
          '/// @mixin\nfunction add_health() {\n  health_points = 100;\n}',
        'objects/o_hero/Create_0': 'add_health();',
        'objects/o_hero/Step_0': 'health_points -= 1;',
      });
      assert.equal(
        p.defAt('objects/o_hero/Step_0', 'health_points'),
        p.declaration('scripts/Mix', 'health_points'),
      );
    });
  });

  describe('doc comments', function () {
    it('types variables with @type, @localvar and @instancevar', async function () {
      const p = await analyzeFiles({
        'objects/o_x/Create_0': [
          '/// @type {Array<String>}',
          'names = [];',
          '/// @instancevar {Real} speed_bonus',
          '/// @localvar {Struct} tmp',
          'tmp = {};',
        ].join('\n'),
      });
      assert.equal(
        p.typeAt('objects/o_x/Create_0', 'names ='),
        'Array<String>',
      );
      assert.equal(p.typeAt('objects/o_x/Create_0', 'speed_bonus'), 'Real');
      assert.ok(p.symbolAt('objects/o_x/Create_0', 'tmp =')?.local);
    });

    it('resolves @see and {@link} targets, and reports broken ones', async function () {
      const p = await analyzeFiles({
        'scripts/A': [
          'function target() {}',
          '/// Like {@link target}, but different.',
          '/// @see target',
          '/// @see missing_thing',
          'function other_fn() {}',
        ].join('\n'),
      });
      assert.equal(p.symbolAt('scripts/A', '@link target')?.kind, 'function');
      assert.equal(p.symbolAt('scripts/A', '@see target')?.kind, 'function');
      const broken = fileDiagnostics(p.analyzer, 'scripts/A').filter(
        (d) => d.code === 'broken-link',
      );
      assert.equal(broken.length, 1);
    });

    it('attaches function docs across blank lines', async function () {
      const p = await analyzeFiles({
        'scripts/A': '/// @param {Real} a\n\nfunction f(a) {}\nf(1, 2);',
      });
      assert.equal(p.symbolAt('scripts/A', 'f(1')?.kind, 'function');
      assert.equal(p.typeAt('scripts/A', 'a)'), 'Real');
      assert.deepEqual(codes(p, 'scripts/A'), ['too-many-arguments']);
    });
  });

  describe('script functions', function () {
    it('treat `self` as the calling instance', async function () {
      const p = await analyzeFiles({
        'scripts/A':
          'function move_me() {\n  x += speed_x;\n  helper_var = 1;\n}',
        'objects/o_thing/Create_0': 'speed_x = 1;',
      });
      // Built-in instance variables resolve; caller variables aren't errors
      assert.equal(p.symbolAt('scripts/A', 'x +=')?.native, 'Base');
      assert.deepEqual(codes(p, 'scripts/A'), ['unused-function']);
    });
  });

  describe('diagnostics', function () {
    it('reports argument counts, allowing explicitly omitted arguments', async function () {
      const p = await analyzeFiles({
        'scripts/A': 'function f(a, b) {}\nf(1);\nf(1, , );\nf(1, 2, 3);',
      });
      assert.deepEqual(codes(p, 'scripts/A'), [
        'missing-argument',
        'too-many-arguments',
      ]);
    });

    it('reports undeclared globals and unused functions', async function () {
      const p = await analyzeFiles({
        'scripts/A': 'function unused() {}\nshow_debug_message(nope);',
      });
      assert.deepEqual(codes(p, 'scripts/A'), [
        'unused-function',
        'undeclared-global',
      ]);
    });

    it('optionally reports mixed operators and argument evaluation order', async function () {
      const p = await analyzeFiles({
        'scripts/A':
          'var a = 1 + 2 * 3;\nvar b = (1 + 2) * 3;\nvar c = a || b && a;\nshow_debug_message(string(a), string(b));',
      });
      const options = {
        mixedOperators: 'info',
        argumentEvaluationOrder: 'info',
      } as const;
      assert.deepEqual(codes(p, 'scripts/A'), []);
      assert.deepEqual(codes(p, 'scripts/A', options), [
        'mixed-operators',
        'mixed-operators',
        'argument-evaluation-order',
      ]);
    });
  });

  describe('incremental updates', function () {
    it('re-checks dependents, matching a fresh analysis', async function () {
      const files = {
        'scripts/Lib': 'function make() { return 1; }\n#macro NAME "x"',
        'scripts/Use': 'var v = make();\nvar n = NAME;',
        'scripts/Unrelated': 'var z = 0;',
      };
      const p = await analyzeFiles(files);
      assert.equal(p.typeAt('scripts/Use', 'var v'), 'Real');
      const result = p.update(
        'scripts/Lib',
        'function make() { return "s"; }\n#macro NAME 5',
      );
      assert.ok(result.checked.has('scripts/Use'));
      assert.ok(!result.checked.has('scripts/Unrelated'));
      assert.equal(p.typeAt('scripts/Use', 'var v'), 'String');
      assert.equal(p.typeAt('scripts/Use', 'NAME'), 'Real');

      // Same as analyzing from scratch
      const fresh = await analyzeFiles({
        ...files,
        'scripts/Lib': p.analyzer.getFile('scripts/Lib')!.text,
      });
      for (const id of Object.keys(files)) {
        const summarize = (a: GmlAnalyzer) =>
          a
            .getAnalysis(id)!
            .refs.map(
              (r) =>
                `${r.start}:${r.symbol}:${formatUnion(a.table.getSymbol(r.symbol)?.type ?? [])}`,
            );
        assert.deepEqual(summarize(p.analyzer), summarize(fresh.analyzer));
      }
    });

    it('handles removed declarations', async function () {
      const p = await analyzeFiles({
        'scripts/Lib': 'function gone() {}',
        'scripts/Use': 'gone();',
      });
      assert.deepEqual(codes(p, 'scripts/Use'), []);
      p.analyzer.removeFile('scripts/Lib');
      p.analyzer.analyze();
      assert.deepEqual(codes(p, 'scripts/Use'), ['undeclared-global']);
    });

    it('does nothing when content is unchanged', async function () {
      const analyzer = new GmlAnalyzer(await getNatives());
      analyzer.setFile(sourceFileFor('scripts/A'), 'var a = 1;');
      analyzer.analyze();
      analyzer.setFile(sourceFileFor('scripts/A'), 'var a = 1;');
      assert.equal(analyzer.analyze().checked.size, 0);
    });
  });

  describe('completions', function () {
    it('lists locals, self members and globals in scope; members after a dot', async function () {
      const p = await analyzeFiles({
        'objects/o_x/Create_0':
          'mine = 1;\nfunction f(param) {\n  var inner = 1;\n  \n}\nvar s = { member: 1 };\ns.',
      });
      const names = (offset: number) =>
        p.queries
          .symbolsInScopeAt('objects/o_x/Create_0', offset)
          .map((s) => s.name);
      const inFunction = names(p.at('objects/o_x/Create_0', '  \n') + 1);
      for (const n of ['param', 'inner', 'mine', 'show_debug_message']) {
        assert.ok(inFunction.includes(n), n);
      }
      const text = p.analyzer.getFile('objects/o_x/Create_0')!.text;
      assert.deepEqual(names(text.length), ['member']);
    });
  });
});
