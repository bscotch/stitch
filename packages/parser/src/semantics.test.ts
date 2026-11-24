/**
 * Struct, constructor and scope semantics from the GameMaker manual, and
 * fixes for reported issues.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { fileDiagnostics, type DiagnosticOptions } from './diagnostics.ts';
import { analyzeFiles } from './test.lib.ts';

const codes = (
  p: Awaited<ReturnType<typeof analyzeFiles>>,
  file: string,
  options: DiagnosticOptions = {},
) => fileDiagnostics(p.analyzer, file, options).map((d) => d.code);

describe('Semantics', function () {
  describe('constructors', function () {
    it('evaluates parent arguments and parameter defaults in the function', async function () {
      const p = await analyzeFiles({
        'scripts/A': [
          'function parent(value = 10) constructor { v = value; }',
          'function child(value = 20) : parent(value) constructor {}',
          'var c = new child();',
        ].join('\n'),
        'objects/o_x/Create_0': 'make = function(_x = x) { return _x; };',
      });
      assert.equal(p.symbolAt('scripts/A', 'parent(value)')?.parameter, true);
      assert.equal(
        p.defAt('scripts/A', 'parent(value)'),
        p.declaration('scripts/A', 'value = 20'),
      );
      // A default using the function's `self`
      assert.equal(p.symbolAt('objects/o_x/Create_0', '= x')?.native, 'Base');
      assert.deepEqual(codes(p, 'scripts/A'), []);
    });

    it('requires `new` for constructors, and only for constructors', async function () {
      const p = await analyzeFiles({
        'scripts/A':
          'function Thing() constructor {}\nfunction plain() {}\nvar a = Thing();\nvar b = new plain();\nvar c = new Thing();',
      });
      assert.deepEqual(codes(p, 'scripts/A'), [
        'invalid-operation',
        'invalid-operation',
      ]);
    });

    it('gives access to static variables through the constructor (#284)', async function () {
      const p = await analyzeFiles({
        'scripts/A': [
          'function Thing() constructor {',
          '  static count = 0;',
          '  static make = function(n) { return n; };',
          '  instance_value = 1;',
          '}',
          'var c = Thing.count;',
          'Thing.make(1);',
          'var s = static_get(Thing).count;',
          'Thing.',
        ].join('\n'),
      });
      const def = p.declaration('scripts/A', 'count = 0');
      assert.equal(p.defAt('scripts/A', 'Thing.count'), def);
      assert.equal(p.defAt('scripts/A', ').count'), def);
      // Signature help for static methods (#200)
      const arg = p.queries.argumentAt(
        'scripts/A',
        p.at('scripts/A', 'make(1') + 5,
      );
      assert.equal(p.queries.parameterFor(arg!)?.name, 'n');
      // Completions after `Thing.`: statics only
      const text = p.analyzer.getFile('scripts/A')!.text;
      const names = p.queries
        .symbolsInScopeAt('scripts/A', text.length)
        .map((s) => s.name);
      assert.deepEqual(names.sort(), ['count', 'make']);
      assert.ok(!codes(p, 'scripts/A').includes('invalid-operation'));
    });
  });

  describe('functions', function () {
    it("keeps a regular function's statics in its static struct", async function () {
      const p = await analyzeFiles({
        'scripts/A':
          'function counter() {\n  static count = 0;\n  return count++;\n}\nvar total = counter.count;',
      });
      const def = p.declaration('scripts/A', 'count = 0');
      assert.equal(p.defAt('scripts/A', 'return count'), def);
      assert.equal(p.defAt('scripts/A', 'counter.count'), def);
      assert.ok(!codes(p, 'scripts/A').includes('invalid-operation'));
    });

    it("doesn't let nested functions see outer locals (no closures)", async function () {
      const p = await analyzeFiles({
        'scripts/A':
          'function outer() {\n  var secret = 1;\n  var f = function() { return secret; };\n}',
      });
      assert.equal(p.symbolAt('scripts/A', 'return secret')?.local, undefined);
    });
  });

  describe('scope', function () {
    it('keeps locals visible inside `with`, and gives locals precedence', async function () {
      const p = await analyzeFiles({
        'objects/o_enemy/Create_0': 'hp = 10;',
        'objects/o_player/Create_0':
          'var hp = 5;\nwith (o_enemy) {\n  self.hp -= hp;\n}',
      });
      const file = 'objects/o_player/Create_0';
      assert.equal(
        p.defAt(file, 'self.hp'),
        p.declaration('objects/o_enemy/Create_0', 'hp'),
      );
      assert.equal(p.defAt(file, '-= hp'), p.declaration(file, 'hp = 5'));
    });

    it('treats `other` in struct literals as the creating scope', async function () {
      const p = await analyzeFiles({
        'objects/o_x/Create_0': 'hp = 1;\nfriend = { their_hp: other.hp };',
      });
      assert.equal(
        p.defAt('objects/o_x/Create_0', 'other.hp'),
        p.declaration('objects/o_x/Create_0', 'hp'),
      );
    });
  });

  describe('object variables from the object editor', function () {
    it('declares them, with types, for the object and its children', async function () {
      const p = await analyzeFiles(
        {
          'objects/o_base/Step_0': 'speed_bonus += 1;',
          'objects/o_child/Create_0':
            'event_inherited();\nspeed_bonus = 2;\nlabel = "x";',
        },
        {
          assets: [
            {
              name: 'o_base',
              kind: 'objects',
              variables: [
                {
                  name: 'speed_bonus',
                  varType: 0,
                  value: '1.5',
                  file: 'objects/o_base/o_base.yy',
                },
                { name: 'label', varType: 2, file: 'objects/o_base/o_base.yy' },
              ],
            },
            { name: 'o_child', kind: 'objects', parent: 'o_base' },
          ],
        },
      );
      const symbol = p.symbolAt('objects/o_base/Step_0', 'speed_bonus');
      assert.equal(symbol?.def?.file, 'objects/o_base/o_base.yy');
      assert.equal(p.typeAt('objects/o_base/Step_0', 'speed_bonus'), 'Real');
      // Children use the same variable
      assert.equal(
        p.symbolAt('objects/o_child/Create_0', 'speed_bonus'),
        symbol,
      );
      assert.equal(p.typeAt('objects/o_child/Create_0', 'label'), 'String');
      assert.deepEqual(codes(p, 'objects/o_base/Step_0'), []);
    });
  });

  describe('reported issues', function () {
    it('shows enum member values (#155)', async function () {
      const p = await analyzeFiles({
        'scripts/A':
          'enum Alarm { spawn, reload = 5, cooldown, neg = -2 }\nvar a = Alarm.cooldown;',
      });
      const hover = p.queries.hover(
        'scripts/A',
        p.at('scripts/A', 'cooldown;'),
      );
      assert.deepEqual(hover?.code, ['Enum.Alarm.cooldown = 6']);
      assert.equal(p.symbolAt('scripts/A', 'neg')?.value, -2);
    });

    it('suppresses diagnostics with @stitch-ignore comments (#259)', async function () {
      const p = await analyzeFiles({
        'scripts/A': [
          'function unused_a() {} // @stitch-ignore: unused-function',
          '// @stitch-ignore-next-line',
          'function unused_b() {}',
          'function unused_c() {} // @stitch-ignore: something-else',
        ].join('\n'),
      });
      assert.deepEqual(codes(p, 'scripts/A'), ['unused-function']);
    });

    it('optionally reports missing docs (#202)', async function () {
      const p = await analyzeFiles({
        'scripts/A':
          '/// Documented\nfunction a() {}\nfunction b() {}\nenum E { x }\na(); b();',
      });
      assert.deepEqual(codes(p, 'scripts/A'), []);
      assert.deepEqual(codes(p, 'scripts/A', { missingDocs: 'info' }), [
        'missing-docs',
        'missing-docs',
      ]);
    });

    it('checks argument types (#91)', async function () {
      const p = await analyzeFiles({
        'scripts/A': [
          '/// @param {Real} n',
          'function f(n) {}',
          'f("text");',
          'f(1);',
          'var maybe = undefined;',
          'maybe = "s";',
          'f(maybe);',
          'f(Color.red);',
          'enum Color { red }',
        ].join('\n'),
      });
      assert.deepEqual(codes(p, 'scripts/A'), ['argument-type']);
      assert.deepEqual(codes(p, 'scripts/A', { argumentTypes: 'off' }), []);
    });

    it('knows built-in audio effect enums and structs (#300)', async function () {
      const p = await analyzeFiles({
        'scripts/A': [
          'var fx = audio_effect_create(AudioEffectType.Reverb1, { size: 0.6 });',
          'var lfo = AudioLFOType.Sine;',
          'fx.bypass = true;',
        ].join('\n'),
      });
      assert.equal(p.symbolAt('scripts/A', 'AudioEffectType')?.native, 'Base');
      assert.equal(p.symbolAt('scripts/A', 'AudioLFOType')?.kind, 'enum');
      assert.equal(p.typeAt('scripts/A', 'var fx'), 'Struct.AudioEffect');
      assert.deepEqual(codes(p, 'scripts/A'), []);
    });
  });

  describe('generics', function () {
    it('infers return types from template parameters', async function () {
      const p = await analyzeFiles({
        'scripts/A': [
          '/// @template T',
          '/// @param {T} value',
          '/// @returns {T}',
          'function identity(value) { return value; }',
          'var str = identity("hello");',
          'var num = identity(42);',
        ].join('\n'),
      });
      assert.equal(p.typeAt('scripts/A', 'var str'), 'String');
      assert.equal(p.typeAt('scripts/A', 'var num'), 'Real');
    });

    it('applies utility types to template parameters', async function () {
      const p = await analyzeFiles(
        {
          'scripts/A': [
            '/// @template {Asset.GMObject} T',
            '/// @param {T} obj',
            '/// @returns {InstanceType<T>}',
            'function make(obj) { return undefined; }',
            '/// @template {Id.Instance} T',
            '/// @param {T} inst',
            '/// @returns {ObjectType<T>}',
            'function object_of(inst) { return undefined; }',
            'var inst = make(o_thing);',
            'var obj = object_of(inst);',
          ].join('\n'),
        },
        { assets: [{ name: 'o_thing', kind: 'objects' }] },
      );
      assert.equal(p.typeAt('scripts/A', 'var inst'), 'Id.Instance.o_thing');
      assert.equal(p.typeAt('scripts/A', 'var obj'), 'Asset.GMObject.o_thing');
    });
  });
});
