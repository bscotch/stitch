import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { leadingDocComments } from './docs.ts';
import { parseDocComment, type DocComment, type DocTag } from './jsdoc.ts';
import { flattenDocType, formatDocType, parseDocType } from './jsdoc.types.ts';
import { parse } from './parser.ts';

/** Parse the doc comment attached to the first statement in `source` */
function doc(source: string): { doc: DocComment; source: string } {
  const parsed = parse(`${source}\nfunction f() {}`);
  const statement = parsed.ast.body.at(-1)!;
  const tokens = leadingDocComments(parsed, statement);
  assert.ok(tokens.length, 'No doc comments found');
  return { doc: parseDocComment(parsed.text, tokens), source: parsed.text };
}

function text(source: string, span: { start: number; end: number } | null) {
  return span ? source.slice(span.start, span.end) : null;
}

function type(input: string): string | null {
  const { type, diagnostics } = parseDocType(input);
  assert.deepEqual(diagnostics, [], `Diagnostics for: ${input}`);
  return type && formatDocType(type);
}

describe('Feather types', function () {
  it('parses names, specifiers and type arguments', function () {
    assert.equal(type('Real'), 'Real');
    assert.equal(type('Asset.GMObject'), 'Asset.GMObject');
    assert.equal(type('Id.Instance.o_player'), 'Id.Instance.o_player');
    assert.equal(type('Array<Real>'), 'Array<Real>');
    assert.equal(type('Id.DsList<Array<Real>>'), 'Id.DsList<Array<Real>>');
    // Bracket syntax is normalized to angle brackets
    assert.equal(type('Array[Real]'), 'Array<Real>');
  });

  it('parses every union syntax', function () {
    for (const input of [
      'String,Real',
      'String|Real',
      'String OR Real',
      'String or Real',
      ' String | Real ',
    ]) {
      assert.equal(type(input), 'String|Real', input);
    }
    assert.equal(
      type('Array<String|Real>|Undefined'),
      'Array<String|Real>|Undefined',
    );
    assert.equal(type('Struct<String, Real>'), 'Struct<String|Real>');
  });

  it('supports standard JSDoc type forms', function () {
    assert.equal(type('*'), '*');
    assert.equal(type('Real[]'), 'Array<Real>');
    assert.equal(type('Real[][]'), 'Array<Array<Real>>');
    assert.equal(type('Function[]|Undefined'), 'Array<Function>|Undefined');
    assert.equal(type('"left"|"right"'), '"left"|"right"');
    assert.equal(type("'a', 'b'"), "'a'|'b'");
  });

  it('treats empty types as unspecified', function () {
    assert.equal(type(''), null);
    assert.equal(type('  '), null);
  });

  it('tracks the location of each name', function () {
    const source = 'Array<Struct.Foo>|Real';
    const { type } = parseDocType(source);
    assert.deepEqual(
      flattenDocType(type!).map((t) => [t.name, source.slice(t.start, t.end)]),
      [
        ['Array', 'Array<Struct.Foo>'],
        ['Struct.Foo', 'Struct.Foo'],
        ['Real', 'Real'],
      ],
    );
  });

  it('reports but recovers from malformed types', function () {
    const wrapped = parseDocType('<String|Real>');
    assert.equal(formatDocType(wrapped.type!), 'String|Real');
    assert.equal(wrapped.diagnostics.length, 1);

    const unclosed = parseDocType('Array<Real');
    assert.equal(formatDocType(unclosed.type!), 'Array<Real>');
    assert.equal(unclosed.diagnostics.length, 1);

    const junk = parseDocType('Real %%');
    assert.equal(formatDocType(junk.type!), 'Real');
    assert.equal(junk.diagnostics.length, 1);
  });
});

describe('JSDoc', function () {
  function tag(d: DocComment, kind: DocTag['kind'], index = 0): DocTag {
    const found = d.tags.filter((t) => t.kind === kind)[index];
    assert.ok(found, `No @${kind} tag at index ${index}`);
    return found;
  }

  it('parses a typical function doc with /// lines', function () {
    const { doc: d, source } = doc(
      [
        '/// @desc Adds things together.',
        '///       Even across lines.',
        '/// @param {Real} a - The first thing',
        '/// @arg {Real|Undefined} [b=1] The second thing',
        '/// @returns {Real} The sum',
      ].join('\n'),
    );
    assert.deepEqual(d.diagnostics, []);
    assert.equal(d.description, null);
    assert.equal(
      tag(d, 'description').description?.text,
      'Adds things together.\nEven across lines.',
    );

    const a = tag(d, 'param');
    assert.equal(a.tagName, 'param');
    assert.equal(a.name?.name, 'a');
    assert.equal(a.name?.optional, false);
    assert.equal(formatDocType(a.type!), 'Real');
    assert.equal(a.description?.text, 'The first thing');

    const b = tag(d, 'param', 1);
    assert.equal(b.tagName, 'arg');
    assert.equal(b.name?.name, 'b');
    assert.equal(b.name?.optional, true);
    assert.equal(b.name?.defaultValue?.text, '1');
    assert.equal(text(source, b.typeSpan), 'Real|Undefined');
    assert.equal(text(source, b.tagSpan), '@arg');

    const returns = tag(d, 'returns');
    assert.equal(formatDocType(returns.type!), 'Real');
    assert.equal(returns.description?.text, 'The sum');
  });

  it('parses /** */ block comments', function () {
    const { doc: d, source } = doc(
      [
        '/**',
        ' * Does a thing.',
        ' * @param {Array<Real>} values The values',
        ' * @returns {Bool}',
        ' */',
      ].join('\n'),
    );
    assert.equal(d.description?.text, 'Does a thing.');
    const param = tag(d, 'param');
    assert.equal(param.name?.name, 'values');
    assert.equal(text(source, param.name), 'values');
    assert.equal(formatDocType(tag(d, 'returns').type!), 'Bool');
    // Single-line block
    const single = doc('/** @type {Real} */');
    assert.equal(formatDocType(tag(single.doc, 'type').type!), 'Real');
  });

  it('handles the parameter name forms seen in the wild', function () {
    const { doc: d } = doc(
      [
        '/// @arg {Bool} respect=true Whether to respect',
        '/// @arg [alpha]',
        '/// @param {Real} [y] The y position',
        '/// @arg [...]',
        '/// @arg ...',
        '/// @arg [more...]',
      ].join('\n'),
    );
    const [respect, alpha, y, rest1, rest2, rest3] = d.tags;
    assert.equal(respect.name?.name, 'respect');
    assert.equal(respect.name?.defaultValue?.text, 'true');
    assert.equal(respect.name?.optional, true);
    assert.equal(respect.description?.text, 'Whether to respect');
    assert.equal(alpha.name?.optional, true);
    assert.equal(alpha.name?.defaultValue, null);
    assert.equal(y.description?.text, 'The y position');
    assert.equal(rest1.name?.rest, true);
    assert.equal(rest1.name?.optional, true);
    assert.equal(rest2.name?.rest, true);
    assert.equal(rest3.name?.name, 'more');
    assert.equal(rest3.name?.rest, true);
    assert.deepEqual(d.diagnostics, []);
  });

  it('parses @self with a bare type, flagging braces', function () {
    const bare = doc('/// @self Struct.Player');
    assert.equal(formatDocType(tag(bare.doc, 'self').type!), 'Struct.Player');
    assert.deepEqual(bare.doc.diagnostics, []);

    const braced = doc('/// @context {Asset.GMObject.o_enemy}');
    assert.equal(
      formatDocType(tag(braced.doc, 'self').type!),
      'Asset.GMObject.o_enemy',
    );
    assert.equal(braced.doc.diagnostics[0].code, 'jsdoc-unexpected-braces');

    const union = doc('/// @self Struct.Dog|Struct.Cat');
    assert.equal(
      formatDocType(tag(union.doc, 'self').type!),
      'Struct.Dog|Struct.Cat',
    );
    assert.deepEqual(union.doc.diagnostics, []);
  });

  it('parses @function signatures and legacy script headers', function () {
    const modern = doc('/// @func my_func(a, b)\n/// @desc Hi');
    assert.equal(tag(modern.doc, 'function').name?.name, 'my_func');

    const legacy = doc('/// draw_nine_slice(sprite, x, y)\n/// @param sprite');
    const header = tag(legacy.doc, 'function');
    assert.equal(header.legacy, true);
    assert.equal(header.name?.name, 'draw_nine_slice');
    assert.equal(tag(legacy.doc, 'param').name?.name, 'sprite');
  });

  it('parses Stitch extension tags', function () {
    const { doc: d } = doc(
      [
        '/// @template {Struct} T',
        '/// @localvar {Real} count The count',
        '/// @instancevar {String} label',
        '/// @globalvar {Array<Real>} SCORES',
        '/// @mixin',
        '/// @type {Real}',
      ].join('\n'),
    );
    assert.deepEqual(
      d.tags.map((t) => [
        t.kind,
        t.name?.name ?? null,
        t.type && formatDocType(t.type),
      ]),
      [
        ['template', 'T', 'Struct'],
        ['localvar', 'count', 'Real'],
        ['instancevar', 'label', 'String'],
        ['globalvar', 'SCORES', 'Array<Real>'],
        ['mixin', null, null],
        ['type', null, 'Real'],
      ],
    );
  });

  it('finds links in descriptions and @see tags', function () {
    const { doc: d, source } = doc(
      [
        '/// @desc Like {@link other_func} but faster.',
        '///   See also {@link Struct.Player|the player}.',
        '/// @see helper_func',
        '/// @see {@link https://example.com/docs}',
      ].join('\n'),
    );
    const description = tag(d, 'description').description!;
    assert.deepEqual(
      description.links.map((l) => [
        l.target,
        l.label,
        text(source, l.targetSpan),
      ]),
      [
        ['other_func', null, 'other_func'],
        ['Struct.Player', 'the player', 'Struct.Player'],
      ],
    );
    const [seeSymbol, seeUrl] = d.tags.filter((t) => t.kind === 'see');
    assert.equal(seeSymbol.description?.links[0].target, 'helper_func');
    assert.equal(
      text(source, seeSymbol.description!.links[0].targetSpan),
      'helper_func',
    );
    assert.equal(
      seeUrl.description?.links[0].target,
      'https://example.com/docs',
    );
  });

  it('keeps unknown tags and modifier tags', function () {
    const { doc: d } = doc(
      '/// @ignore\n/// @pure\n/// @deprecated Use other\n/// @internal Some note',
    );
    assert.deepEqual(
      d.tags.map((t) => [t.kind, t.tagName, t.description?.text ?? null]),
      [
        ['ignore', 'ignore', null],
        ['pure', 'pure', null],
        ['deprecated', 'deprecated', 'Use other'],
        ['unknown', 'internal', 'Some note'],
      ],
    );
  });

  it('reports problems without giving up', function () {
    const { doc: d } = doc(
      [
        '/// @param {Real a',
        '/// @param',
        '/// @param {Real} x',
        '/// @param {String} x',
      ].join('\n'),
    );
    assert.deepEqual(
      d.diagnostics.map((x) => x.code),
      ['jsdoc-unterminated', 'jsdoc-expected-name', 'jsdoc-duplicate-param'],
    );
    assert.equal(d.tags.length, 4);
  });
});
