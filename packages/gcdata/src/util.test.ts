import { expect } from 'chai';
import { assertThrows } from './assert.js';
import {
  computeTerminalPointers,
  debugOnError,
  setValueAtPointer,
} from './util.js';

describe('Utilities', function () {
  it('can get all pointers in an object', function () {
    const data = {
      a: {
        b: {
          c: 1,
          d: 2,
        },
      },
      e: {
        f: 3,
      },
    };
    const pointers = computeTerminalPointers(data);
    expect(pointers).to.deep.equal(new Set(['a/b/c', 'a/b/d', 'e/f']));

    const pointers2 = computeTerminalPointers(data, 'prefix');
    expect(pointers2).to.deep.equal(
      new Set(['prefix/a/b/c', 'prefix/a/b/d', 'prefix/e/f']),
    );
  });

  it('can get debugOnFail results when there is no error', function () {
    expect(debugOnError(() => 10)).to.equal(10);
  });

  it('can set values using a pointer', function () {
    let data = {};
    setValueAtPointer(data, ['a', 'b', 'c'], 'd');
    expect(data).to.deep.equal({ a: { b: { c: 'd' } } });

    assertThrows(
      () => setValueAtPointer(data, ['a', 'b', 'c', 'd'], 'e'),
      'Cannot set value at pointer ["a","b","c","d"] because ["a","b","c"] is not an object',
    );
  });
});
