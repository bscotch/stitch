import { undent } from '@bscotch/utility';
import { expect } from 'chai';
import { parseFeatherTypeString } from './jsdoc.feather.js';
import { parseJsdoc } from './jsdoc.js';

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
    expect(parsed.kind).to.equal('union');
    expect(parsed.types).to.have.lengthOf(3);
    expect(parsed.types[0].kind).to.equal('type');
    expect(parsed.types[0].name).to.equal('Array');
    expect(parsed.types[0].of?.kind).to.equal('union');
    expect(parsed.types[0].of?.types).to.have.lengthOf(2);
    expect(parsed.types[0].of?.types[0].kind).to.equal('type');
    expect(parsed.types[0].of?.types[0].name).to.equal('string');
    expect(parsed.types[0].of?.types[1].kind).to.equal('type');
    expect(parsed.types[0].of?.types[1].name).to.equal('Array');
    expect(parsed.types[0].of?.types[1].of?.kind).to.equal('union');
    expect(parsed.types[0].of?.types[1].of?.types).to.have.lengthOf(1);
    expect(parsed.types[0].of?.types[1].of?.types[0].kind).to.equal('type');
    expect(parsed.types[0].of?.types[1].of?.types[0].name).to.equal('Real');
    expect(parsed.types[1].kind).to.equal('type');
    expect(parsed.types[1].name).to.equal('Struct.Hello');
    expect(parsed.types[2].kind).to.equal('type');
    expect(parsed.types[2].name).to.equal('Id.Map');
    expect(parsed.types[2].of?.kind).to.equal('union');
    expect(parsed.types[2].of?.types).to.have.lengthOf(2);
    expect(parsed.types[2].of?.types[0].kind).to.equal('type');
    expect(parsed.types[2].of?.types[0].name).to.equal('String');
    expect(parsed.types[2].of?.types[1].kind).to.equal('type');
    expect(parsed.types[2].of?.types[1].name).to.equal('Real');
  });

  it('can parse GML-style Function JSDocs', function () {
    const jsdoc = functionJsdoc;
    const parsed = parseJsdoc(jsdoc);
    expect(parsed.kind).to.equal('function');
    expect(parsed.deprecated).to.equal(true);
    expect(parsed.self?.content).to.equal('Struct.AnotherConstructor');
    expect(parsed.description).to.equal('This is a multiline\ndescription.');
    expect(parsed.params).to.have.lengthOf(5);
    expect(parsed.params![0].name?.content).to.equal('first');
    expect(parsed.params![0].type?.content).to.equal('String');
    expect(parsed.params![0].description).to.equal(
      'This is the first parameter',
    );
    expect(parsed.params![1].name?.content).to.equal('second');
    expect(parsed.params![1].type?.content).to.equal('Real');
    expect(parsed.params![1].description).to.equal(
      'This is the second parameter,\nwhich spans multiple lines.',
    );
    expect(parsed.params![2].name?.content).to.equal('third');
    expect(parsed.params![2].type?.content).to.equal('Struct');
    expect(parsed.params![2].optional).to.equal(true);
    expect(parsed.params![2].description).to.equal(
      'This parameter is optional',
    );
    expect(parsed.params![3].name?.content).to.equal('fourth');
    expect(parsed.params![3].type?.content).to.equal('Struct');
    expect(parsed.params![3].optional).to.equal(true);
    expect(parsed.params![3].description).to.equal(
      'This is optional and has a default value',
    );
    expect(parsed.params![4].name?.content).to.equal('...');
    expect(parsed.params![4].type?.content).to.equal('Bool');
    expect(parsed.params![4].optional).to.equal(true);
    expect(parsed.params![4].description).to.equal(
      'And so is this one, but there can be as many as you want!',
    );
  });

  it('can parse JS-style Function JSDocs', function () {
    const jsdoc = functionJsdocJs;
    const parsed = parseJsdoc(jsdoc);
    expect(parsed.kind).to.equal('function');
    expect(parsed.deprecated).to.equal(true);
    expect(parsed.self?.content).to.equal('Struct.AnotherConstructor');
    expect(parsed.description).to.equal('This is a multiline\ndescription.');
    expect(parsed.params).to.have.lengthOf(5);
    expect(parsed.params![0].name?.content).to.equal('first');
    expect(parsed.params![0].type?.content).to.equal('String');
    expect(parsed.params![0].description).to.equal(
      'This is the first parameter',
    );
    expect(parsed.params![1].name?.content).to.equal('second');
    expect(parsed.params![1].type?.content).to.equal('Real');
    expect(parsed.params![1].description).to.equal(
      'This is the second parameter,\nwhich spans multiple lines.',
    );
    expect(parsed.params![2].name?.content).to.equal('third');
    expect(parsed.params![2].type?.content).to.equal('Struct');
    expect(parsed.params![2].optional).to.equal(true);
    expect(parsed.params![2].description).to.equal(
      'This parameter is optional',
    );
    expect(parsed.params![3].name?.content).to.equal('fourth');
    expect(parsed.params![3].type?.content).to.equal('Struct');
    expect(parsed.params![3].optional).to.equal(true);
    expect(parsed.params![3].description).to.equal(
      'This is optional and has a default value',
    );
    expect(parsed.params![4].name?.content).to.equal('...');
    expect(parsed.params![4].type?.content).to.equal('Bool');
    expect(parsed.params![4].optional).to.equal(true);
    expect(parsed.params![4].description).to.equal(
      'And so is this one, but there can be as many as you want!',
    );
  });

  it('can parse a GML type tag', function () {
    const jsdoc = '/// @type {String} - This is a string';
    const parsed = parseJsdoc(jsdoc);
    expect(parsed.kind).to.equal('type');
    expect(parsed.type?.content).to.equal('String');
    expect(parsed.description).to.equal('This is a string');
  });

  it('can parse a JS type tag', function () {
    const jsdoc = '@type {String} This is a string';
    const parsed = parseJsdoc(jsdoc);
    expect(parsed.kind).to.equal('type');
    expect(parsed.type?.content).to.equal('String');
    expect(parsed.description).to.equal('This is a string');
  });

  it('can parse a self tag', function () {
    const jsdoc = '/// @self Struct.Hello';
    const parsed = parseJsdoc(jsdoc);
    expect(parsed.kind).to.equal('self');
    expect(parsed.self?.content).to.equal('Struct.Hello');
  });

  it('can parse template tags', function () {
    const jsdoc = undent`
      /// @template T
      /// @template {String} U
      /// @param {T} first
      /// @returns {U}
    `;
    const parsed = parseJsdoc(jsdoc);
    expect(parsed.kind).to.equal('function');
    expect(parsed.templates).to.have.lengthOf(2);
    expect(parsed.templates![0].name?.content).to.equal('T');
    expect(parsed.templates![0].type).to.be.undefined;
    expect(parsed.templates![1].name?.content).to.equal('U');
    expect(parsed.templates![1].type?.content).to.equal('String');
    expect(parsed.params).to.have.lengthOf(1);
    expect(parsed.params![0].name?.content).to.equal('first');
    expect(parsed.params![0].type?.content).to.equal('T');
    expect(parsed.returns?.type?.content).to.equal('U');
  });
});
