import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { undent } from '@bscotch/utility';
import { parseFeatherTypeString } from './jsdoc.feather.ts';
import { parseJsdoc } from './jsdoc.ts';

const functionJsdoc = `
/// @desc This is a multiline
///       description.
/// @param {String} first - This is the first parameter
/// @param {Real} second This is the second parameter,
///        which spans multiple lines.
/// @param {Struct} [third] This parameter is optional
/// @param {Struct} [fourth = "bleh" ] This is optional and has a default value
/// @param {Bool} [...] And so is this one, but there can be as many as you want!
/// @returns {Struct} And here is a multiline
///  description of the return type.
/// @self Struct.AnotherConstructor
/// @deprecated`;

const functionJsdocJs = `
* @desc This is a multiline
*       description.
@param {String} first This is the first parameter
* @param {Real} second - This is the second parameter,
*        which spans multiple lines.
* @param {Struct} [third] This parameter is optional
* @param {Struct} [fourth = "bleh" ] This is optional and has a default value
* @param {Bool} [...] And so is this one, but there can be as many as you want!
* @returns {Struct} And here is a multiline
*  description of the return type.
* @self Struct.AnotherConstructor
* @deprecated`;

describe('JSDocs', function () {
  it('can parse Feather typestrings', function () {
    const complexType =
      'Array<string OR Array<Real>> or Struct.Hello or Id.Map<String,Real>';
    const parsed = parseFeatherTypeString(complexType);
    assert.equal(parsed.kind, 'union');
    assert.equal(parsed.types.length, 3);
    assert.equal(parsed.types[0].kind, 'type');
    assert.equal(parsed.types[0].name.content, 'Array');
    assert.equal(parsed.types[0].of?.kind, 'union');
    assert.equal((parsed.types[0].of?.types).length, 2);
    assert.equal(parsed.types[0].of?.types[0].kind, 'type');
    assert.equal(parsed.types[0].of?.types[0].name.content, 'string');
    assert.equal(parsed.types[0].of?.types[1].kind, 'type');
    assert.equal(parsed.types[0].of?.types[1].name.content, 'Array');
    assert.equal(parsed.types[0].of?.types[1].of?.kind, 'union');
    assert.equal((parsed.types[0].of?.types[1].of?.types).length, 1);
    assert.equal(parsed.types[0].of?.types[1].of?.types[0].kind, 'type');
    assert.equal(
      parsed.types[0].of?.types[1].of?.types[0].name.content,
      'Real',
    );
    assert.equal(parsed.types[1].kind, 'type');
    assert.equal(parsed.types[1].name.content, 'Struct.Hello');
    assert.equal(parsed.types[2].kind, 'type');
    assert.equal(parsed.types[2].name.content, 'Id.Map');
    assert.equal(parsed.types[2].of?.kind, 'union');
    assert.equal((parsed.types[2].of?.types).length, 2);
    assert.equal(parsed.types[2].of?.types[0].kind, 'type');
    assert.equal(parsed.types[2].of?.types[0].name.content, 'String');
    assert.equal(parsed.types[2].of?.types[1].kind, 'type');
    assert.equal(parsed.types[2].of?.types[1].name.content, 'Real');
  });

  it('can parse GML-style Function JSDocs', function () {
    const jsdoc = functionJsdoc;
    const parsed = parseJsdoc(jsdoc);
    assert.equal(parsed.kind, 'function');
    assert.equal(parsed.deprecated, true);
    assert.equal(parsed.self?.content, 'Struct.AnotherConstructor');
    assert.equal(parsed.description, 'This is a multiline\ndescription.');
    assert.equal(parsed.params?.length, 5);
    assert.equal(parsed.params![0].name?.content, 'first');
    assert.equal(parsed.params![0].type?.content, 'String');
    assert.equal(parsed.params![0].description, 'This is the first parameter');
    assert.equal(parsed.params![1].name?.content, 'second');
    assert.equal(parsed.params![1].type?.content, 'Real');
    assert.equal(
      parsed.params![1].description,
      'This is the second parameter,\nwhich spans multiple lines.',
    );
    assert.equal(parsed.params![2].name?.content, 'third');
    assert.equal(parsed.params![2].type?.content, 'Struct');
    assert.equal(parsed.params![2].optional, true);
    assert.equal(parsed.params![2].description, 'This parameter is optional');
    assert.equal(parsed.params![3].name?.content, 'fourth');
    assert.equal(parsed.params![3].type?.content, 'Struct');
    assert.equal(parsed.params![3].optional, true);
    assert.equal(
      parsed.params![3].description,
      'This is optional and has a default value',
    );
    assert.equal(parsed.params![4].name?.content, '...');
    assert.equal(parsed.params![4].type?.content, 'Bool');
    assert.equal(parsed.params![4].optional, true);
    assert.equal(
      parsed.params![4].description,
      'And so is this one, but there can be as many as you want!',
    );
  });

  it('can parse JS-style Function JSDocs', function () {
    const jsdoc = functionJsdocJs;
    const parsed = parseJsdoc(jsdoc);
    assert.equal(parsed.kind, 'function');
    assert.equal(parsed.deprecated, true);
    assert.equal(parsed.self?.content, 'Struct.AnotherConstructor');
    assert.equal(parsed.description, 'This is a multiline\ndescription.');
    assert.equal(parsed.params?.length, 5);
    assert.equal(parsed.params![0].name?.content, 'first');
    assert.equal(parsed.params![0].type?.content, 'String');
    assert.equal(parsed.params![0].description, 'This is the first parameter');
    assert.equal(parsed.params![1].name?.content, 'second');
    assert.equal(parsed.params![1].type?.content, 'Real');
    assert.equal(
      parsed.params![1].description,
      'This is the second parameter,\nwhich spans multiple lines.',
    );
    assert.equal(parsed.params![2].name?.content, 'third');
    assert.equal(parsed.params![2].type?.content, 'Struct');
    assert.equal(parsed.params![2].optional, true);
    assert.equal(parsed.params![2].description, 'This parameter is optional');
    assert.equal(parsed.params![3].name?.content, 'fourth');
    assert.equal(parsed.params![3].type?.content, 'Struct');
    assert.equal(parsed.params![3].optional, true);
    assert.equal(
      parsed.params![3].description,
      'This is optional and has a default value',
    );
    assert.equal(parsed.params![4].name?.content, '...');
    assert.equal(parsed.params![4].type?.content, 'Bool');
    assert.equal(parsed.params![4].optional, true);
    assert.equal(
      parsed.params![4].description,
      'And so is this one, but there can be as many as you want!',
    );
  });

  it('can parse a GML type tag', function () {
    const jsdoc = '/// @type {String} - This is a string';
    const parsed = parseJsdoc(jsdoc);
    assert.equal(parsed.kind, 'type');
    assert.equal(parsed.type?.content, 'String');
    assert.equal(parsed.description, 'This is a string');
  });

  it('can parse a JS type tag', function () {
    const jsdoc = '@type {String} This is a string';
    const parsed = parseJsdoc(jsdoc);
    assert.equal(parsed.kind, 'type');
    assert.equal(parsed.type?.content, 'String');
    assert.equal(parsed.description, 'This is a string');
  });

  it('can parse a self tag', function () {
    const jsdoc = '/// @self Struct.Hello';
    const parsed = parseJsdoc(jsdoc);
    assert.equal(parsed.kind, 'self');
    assert.equal(parsed.self?.content, 'Struct.Hello');
  });

  it('can parse template tags', function () {
    const jsdoc = undent`
      /// @template T
      /// @template {String} U
      /// @param {T} first
      /// @returns {U}
    `;
    const parsed = parseJsdoc(jsdoc);
    assert.equal(parsed.kind, 'function');
    assert.equal(parsed.templates?.length, 2);
    assert.equal(parsed.templates![0].name?.content, 'T');
    assert.equal(parsed.templates![0].type, undefined);
    assert.equal(parsed.templates![1].name?.content, 'U');
    assert.equal(parsed.templates![1].type?.content, 'String');
    assert.equal(parsed.params?.length, 1);
    assert.equal(parsed.params![0].name?.content, 'first');
    assert.equal(parsed.params![0].type?.content, 'T');
    assert.equal(parsed.returns?.type?.content, 'U');
  });

  it('can parse utility types', function () {
    const jsdoc = undent`
      /// @template {Asset.GMObject} T
      /// @param {T} first
      /// @returns {InstanceType<T>}
    `;
    const parsed = parseJsdoc(jsdoc);
    assert.equal(parsed.kind, 'function');
    assert.equal(parsed.templates?.length, 1);
    assert.equal(parsed.templates![0].name?.content, 'T');
    assert.equal(parsed.templates![0].type?.content, 'Asset.GMObject');
    assert.equal(parsed.params?.length, 1);
    assert.equal(parsed.params![0].name?.content, 'first');
    assert.equal(parsed.params![0].type?.content, 'T');
    assert.equal(parsed.returns?.type?.content, 'InstanceType<T>');
  });

  it('can identify typstring ranges', function () {
    const jsdoc = '/// @type {X|Array<Struct.GlobalConstructor>|String}';
    const parsed = parseJsdoc(jsdoc);
    const ranges = parsed.typeRanges;
    assert.equal(ranges.length, 4);

    for (const range of ranges) {
      const startOffset = jsdoc.indexOf(range.content);
      assert.equal(range.start.offset, startOffset);
      assert.equal(range.end.offset, startOffset + range.content.length - 1);
      assert.equal(range.start.column, startOffset + 1);
      assert.equal(range.end.column, startOffset + range.content.length);
      assert.equal(range.start.line, 1);
      assert.equal(range.end.line, 1);
    }
  });
});
