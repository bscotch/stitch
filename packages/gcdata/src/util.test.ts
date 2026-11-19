import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { assertThrows } from './assert.ts';
import {
  computeTerminalPointers,
  debugOnError,
  setValueAtPointer,
} from './util.ts';

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
    assert.deepEqual(pointers, new Set(['a/b/c', 'a/b/d', 'e/f']));

    const pointers2 = computeTerminalPointers(data, 'prefix');
    assert.deepEqual(
      pointers2,
      new Set(['prefix/a/b/c', 'prefix/a/b/d', 'prefix/e/f']),
    );
  });

  it('can get debugOnFail results when there is no error', function () {
    assert.equal(
      debugOnError(() => 10),
      10,
    );
  });

  it('can set values using a pointer', function () {
    let data = {};
    setValueAtPointer(data, ['a', 'b', 'c'], 'd');
    assert.deepEqual(data, { a: { b: { c: 'd' } } });

    assertThrows(
      () => setValueAtPointer(data, ['a', 'b', 'c', 'd'], 'e'),
      'Cannot set value at pointer ["a","b","c","d"] because ["a","b","c"] is not an object',
    );
  });
});
