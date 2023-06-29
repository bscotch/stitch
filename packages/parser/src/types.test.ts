import { expect } from 'chai';
import { Type } from './types.js';

describe('Types', function () {
  it('can check whether one simple type satisfies another', function () {
    const string = new Type('String');
    expect(string.narrows(new Type('String'))).to.be.true;
    expect(string.narrows(new Type('Real'))).to.be.false;

    const union = new Type('Union').addUnionType(new Type('String'));
    expect(string.narrows(union)).to.be.true;
    expect(union.narrows(string)).to.be.false;
  });

  it('can check whether one struct type satisfies another', function () {
    const broadStruct = new Type('Struct');
    const narrowStruct = new Type('Struct');

    for (const struct of [broadStruct, narrowStruct]) {
      struct.setMember('name', new Type('String'));
      struct.setMember('id', new Type('Real'));
    }

    // They are the same at the moment, so should be true both ways
    expect(narrowStruct.narrows(broadStruct)).to.be.true;
    expect(broadStruct.narrows(narrowStruct)).to.be.true;

    // Now making the narrow struct more specific
    narrowStruct.setMember('specialty', new Type('String'));
    expect(narrowStruct.narrows(broadStruct)).to.be.true;
    expect(broadStruct.narrows(narrowStruct)).to.be.false;
  });
});
