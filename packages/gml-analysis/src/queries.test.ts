import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { analyzeFiles } from './test.lib.ts';

const lib = [
  '/// Makes a point.',
  '/// @param {Real} x The x position',
  '/// @param {Real} [y]',
  'function Point(x, y = 0) constructor {',
  '  self.x = x;',
  '  self.y = y;',
  '}',
  '/// Adds things. See {@link Point}.',
  '/// @param {Struct.Point} p',
  '/// @returns {Real}',
  'function add(p) { return p.x + p.y; }',
].join('\n');
const use = 'var pt = new Point(1);\nvar sum = add(pt);\nvar list = [];';

describe('Queries', function () {
  it('describes symbols on hover', async function () {
    const p = await analyzeFiles({ 'scripts/Lib': lib, 'scripts/Use': use });
    const fn = p.queries.hover('scripts/Use', p.at('scripts/Use', 'add'));
    assert.deepEqual(fn?.code, ['function add(p: Struct.Point): Real']);
    assert.ok(fn?.text.includes('Adds things. See {@link Point}.'));

    const ctor = p.queries.hover('scripts/Use', p.at('scripts/Use', 'Point'));
    assert.deepEqual(ctor?.code, [
      'function Point(x: Real, y?: Real) constructor: Struct.Point',
    ]);
    assert.ok(
      ctor?.text.some((t) => t.includes('@param* `x` - The x position')),
    );

    const pt = p.queries.hover('scripts/Use', p.at('scripts/Use', 'pt'));
    assert.deepEqual(pt?.code, ['Struct.Point']);
    assert.ok(
      pt?.text.some((t) => t.includes('x: Real') && t.includes('y: Real')),
    );
  });

  it('finds definitions, type definitions and references', async function () {
    const p = await analyzeFiles({ 'scripts/Lib': lib, 'scripts/Use': use });
    const def = p.queries.definition('scripts/Use', p.at('scripts/Use', 'add'));
    assert.equal(def?.file, 'scripts/Lib');
    assert.equal(def?.start, p.at('scripts/Lib', 'add(p)'));

    const [typeDef] = p.queries.typeDefinition(
      'scripts/Use',
      p.at('scripts/Use', 'pt'),
    );
    assert.equal(typeDef.start, p.at('scripts/Lib', 'Point('));

    const refs = p.queries.references(
      'scripts/Use',
      p.at('scripts/Use', 'Point'),
    );
    // Declaration, the {@link}, the doc type, and the use
    assert.equal(refs.length, 4);
    const withoutDecl = p.queries.references(
      'scripts/Use',
      p.at('scripts/Use', 'Point'),
      {
        includeDeclaration: false,
      },
    );
    assert.equal(withoutDecl.length, 3);
  });

  it('computes rename edits across files and docs', async function () {
    const p = await analyzeFiles({ 'scripts/Lib': lib, 'scripts/Use': use });
    const edits = p.queries.renameEdits(
      'scripts/Use',
      p.at('scripts/Use', 'Point'),
      'Vec',
    );
    assert.equal(edits.length, 4);
    assert.ok(edits.every((e) => e.newText === 'Vec'));
    for (const edit of edits) {
      const text = p.analyzer.getFile(edit.file)!.text;
      assert.equal(text.slice(edit.start, edit.end), 'Point');
    }
    // Natives, assets, invalid names and clashes are refused
    assert.equal(
      p.queries.canRename('scripts/Use', p.at('scripts/Use', 'pt') + 100),
      undefined,
    );
    assert.throws(() =>
      p.queries.renameEdits('scripts/Use', p.at('scripts/Use', 'pt'), '1bad'),
    );
    assert.throws(() =>
      p.queries.renameEdits('scripts/Use', p.at('scripts/Use', 'pt'), 'sum'),
    );
    assert.throws(() =>
      p.queries.renameEdits('scripts/Lib', p.at('scripts/Lib', 'x =') - 5, 'q'),
    );
  });

  it('refuses to rename natives and assets', async function () {
    const p = await analyzeFiles({
      'objects/o_thing/Create_0': 'show_debug_message(o_thing);',
    });
    const file = 'objects/o_thing/Create_0';
    assert.equal(
      p.queries.canRename(file, p.at(file, 'show_debug')),
      undefined,
    );
    assert.equal(p.queries.canRename(file, p.at(file, 'o_thing)')), undefined);
  });

  it('produces semantic tokens', async function () {
    const p = await analyzeFiles({ 'scripts/Lib': lib, 'scripts/Use': use });
    const tokens = p.queries.semanticTokens('scripts/Use');
    const tokenAt = (needle: string) =>
      tokens.find((t) => t.start === p.at('scripts/Use', needle));
    assert.equal(tokenAt('Point')?.type, 'class');
    assert.equal(tokenAt('add')?.type, 'function');
    assert.deepEqual(tokenAt('pt')?.modifiers, ['local', 'declaration']);
    const lib2 = p.queries.semanticTokens('scripts/Lib');
    const param = lib2.find((t) => t.start === p.at('scripts/Lib', 'x, y'));
    assert.equal(param?.type, 'parameter');
  });

  it('lists workspace symbols', async function () {
    const p = await analyzeFiles({ 'scripts/Lib': lib });
    const names = p.queries
      .workspaceSymbols('')
      .map((s) => `${s.container ?? ''}.${s.name}`);
    assert.ok(names.includes('.Point'));
    assert.ok(names.includes('.add'));
    assert.ok(names.includes('Point.x'));
    assert.deepEqual(
      p.queries.workspaceSymbols('ADD').map((s) => s.name),
      ['add'],
    );
  });

  it('offers struct members and doc comment contexts for completion', async function () {
    const p = await analyzeFiles({
      'scripts/A':
        'var s = {\n  a: 1,\n  \n};\n/// @param {Real} x\nfunction f(x) {}',
    });
    const members = p.queries.structMembersAt(
      'scripts/A',
      p.at('scripts/A', '  \n') + 1,
    );
    assert.deepEqual(
      members?.map((m) => m.name),
      ['a'],
    );
    assert.ok(p.queries.docCommentAt('scripts/A', p.at('scripts/A', '{Real}')));
    assert.ok(p.queries.typeNames().includes('Id.DsMap'));
  });
});
