import { expect } from 'chai';
import { sequential } from './utility.js';

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe('Utility', function () {
  it('can enforce sequential method calls', async function () {
    class MyClass {
      values: any[] = [];

      @sequential
      async addValue(value: any, delayMs = 0) {
        await delay(delayMs);
        this.values.push(value);
      }
    }

    const myClass = new MyClass();
    await Promise.all([
      myClass.addValue(1, 100),
      myClass.addValue(2, 75),
      myClass.addValue(3, 30),
    ]);
    expect(myClass.values).to.deep.equal([1, 2, 3]);
  });
});
