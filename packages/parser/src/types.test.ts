import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { replaceGenerics, updateGenericsMap } from './types.checks.ts';
import { type KnownTypesMap, typeFromFeatherString } from './types.feather.ts';
import { Type, TypeStore } from './types.ts';

describe('Types', function () {
  it('can resursively resolve generic types', function () {
    const genericType = new Type('Any').named('T').genericize();
    const generics = [{ T: [genericType] }];
    const toType = (s: string) => typeFromFeatherString(s, generics, false);

    const knownTypes: KnownTypesMap = new Map();

    let resolved = updateGenericsMap(
      genericType,
      new Type('String'),
      knownTypes,
    );
    assert.equal(resolved.get('T')!.type[0].kind, 'String');

    resolved = updateGenericsMap(
      toType('Array<T>'),
      new Type('String'),
      knownTypes,
    );
    assert.equal(resolved.get('T'), undefined);

    resolved = updateGenericsMap(
      toType('Array<T>'),
      toType('Array<String>'),
      knownTypes,
    );
    assert.equal(resolved.get('T')!.type[0].kind, 'String');

    resolved = updateGenericsMap(
      toType('Array<T>'),
      toType('Array<Struct<String>>'),
      knownTypes,
    );
    assert.equal(resolved.get('T')!.type[0].kind, 'Struct');
    assert.equal(resolved.get('T')!.type[0].items!.type[0].kind, 'String');

    // For cases with mixed types, this should still all work!
    resolved = updateGenericsMap(
      toType('Real|Array<T>|Struct<Array<T>>'),
      toType('Real|Struct<String>|Array<Id.DsMap>|Struct<Array<Id.Instance>>'),
      knownTypes,
    );
    const resolvedTypes = resolved.get('T')!.type;
    assert.equal(resolvedTypes.length, 2);
    assert.equal(resolvedTypes[0].kind, 'Id.DsMap');
    assert.equal(resolvedTypes[1].kind, 'Id.Instance');

    // Make sure we can substitue generics
    const replaced = replaceGenerics(
      toType('Real|Array<T>|Struct<Array<T>>|ObjectType<Id.Instance>'),
      knownTypes,
      resolved,
    );
    assert.equal(replaced.type[0].kind, 'Real');
    assert.equal(replaced.type[1].kind, 'Array');
    assert.equal(replaced.type[1].items!.type[0].kind, 'Id.DsMap');
    assert.equal(replaced.type[1].items!.type[1].kind, 'Id.Instance');
    assert.equal(replaced.type[2].kind, 'Struct');
    assert.equal(replaced.type[2].items!.type[0].kind, 'Array');
    assert.equal(
      replaced.type[2].items!.type[0].items!.type[0].kind,
      'Id.DsMap',
    );
    assert.equal(
      replaced.type[2].items!.type[0].items!.type[1].kind,
      'Id.Instance',
    );
  });

  it('can check whether one simple type satisfies another', function () {
    const string = new Type('String');
    assert.equal(string.narrows(new Type('String')), true);
    assert.equal(string.narrows(new Type('Real')), false);

    const union = new TypeStore();
    union.type = [new Type('String'), new Type('Real')];
    assert.equal(string.narrows(union), true);
    assert.equal(union.narrows(string), false);
  });

  it('can check whether one struct type satisfies another', function () {
    const broadStruct = new Type('Struct');
    const narrowStruct = new Type('Struct');

    for (const struct of [broadStruct, narrowStruct]) {
      struct.addMember('name', { type: new Type('String') });
      struct.addMember('id', { type: new Type('Real') });
    }

    // They are the same at the moment, so should be true both ways
    assert.equal(narrowStruct.narrows(broadStruct), true);
    assert.equal(broadStruct.narrows(narrowStruct), true);

    // Now making the narrow struct more specific
    narrowStruct.addMember('specialty', { type: new Type('String') });
    assert.equal(narrowStruct.narrows(broadStruct), true);
    assert.equal(broadStruct.narrows(narrowStruct), false);
  });
});
