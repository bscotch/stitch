import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { sequential } from '@bscotch/utility';
import { __decorate } from 'tslib';

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe('Utility', function () {
  it('can enforce sequential method calls', async function () {
    class MyClass {
      values: any[] = [];

      async addValue(value: any, delayMs = 0) {
        await delay(delayMs);
        this.values.push(value);
      }
    }
    // Node can't run decorator syntax, so apply it explicitly
    __decorate([sequential], MyClass.prototype, 'addValue', null);

    const myClass = new MyClass();
    await Promise.all([
      myClass.addValue(1, 100),
      myClass.addValue(2, 75),
      myClass.addValue(3, 30),
    ]);
    assert.deepEqual(myClass.values, [1, 2, 3]);
  });
});
