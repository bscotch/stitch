import { expect } from 'chai';
import { updateGenericsMap } from './types.checks.js';
import { typeFromFeatherString } from './types.feather.js';
import { Type, TypeStore } from './types.js';

describe('Types', function () {
  it('can resursively resolve generic types', function () {
    const genericType = new Type('Any').named('T').genericize();
    const generics = [{ T: [genericType] }];
    const toType = (s: string) => typeFromFeatherString(s, generics, false);

    let resolved = updateGenericsMap(genericType, new Type('String'));
    expect(resolved.get('T')!.type[0].kind).to.equal('String');

    resolved = updateGenericsMap(toType('Array<T>'), new Type('String'));
    expect(resolved.get('T')).to.be.undefined;

    resolved = updateGenericsMap(toType('Array<T>'), toType('Array<String>'));
    expect(resolved.get('T')!.type[0].kind).to.equal('String');

    resolved = updateGenericsMap(
      toType('Array<T>'),
      toType('Array<Struct<String>>'),
    );
    expect(resolved.get('T')!.type[0].kind).to.equal('Struct');
    expect(resolved.get('T')!.type[0].items!.type[0].kind).to.equal('String');

    // For cases with mixed types, this should still all work!
    resolved = updateGenericsMap(
      toType('Real|Array<T>|Struct<Array<T>>'),
      toType('Real|Struct<String>|Array<Id.DsMap>|Struct<Array<Id.Instance>>'),
    );
    const resolvedTypes = resolved.get('T')!.type;
    expect(resolvedTypes.length).to.equal(2);
    expect(resolvedTypes[0].kind).to.equal('Id.DsMap');
    expect(resolvedTypes[1].kind).to.equal('Id.Instance');
  });

  it('can check whether one simple type satisfies another', function () {
    const string = new Type('String');
    expect(string.narrows(new Type('String'))).to.be.true;
    expect(string.narrows(new Type('Real'))).to.be.false;

    const union = new TypeStore();
    union.type = [new Type('String'), new Type('Real')];
    expect(string.narrows(union)).to.be.true;
    expect(union.narrows(string)).to.be.false;
  });

  it('can check whether one struct type satisfies another', function () {
    const broadStruct = new Type('Struct');
    const narrowStruct = new Type('Struct');

    for (const struct of [broadStruct, narrowStruct]) {
      struct.addMember('name', new Type('String'));
      struct.addMember('id', new Type('Real'));
    }

    // They are the same at the moment, so should be true both ways
    expect(narrowStruct.narrows(broadStruct)).to.be.true;
    expect(broadStruct.narrows(narrowStruct)).to.be.true;

    // Now making the narrow struct more specific
    narrowStruct.addMember('specialty', new Type('String'));
    expect(narrowStruct.narrows(broadStruct)).to.be.true;
    expect(broadStruct.narrows(narrowStruct)).to.be.false;
  });
});
