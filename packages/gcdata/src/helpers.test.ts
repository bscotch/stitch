import { ok } from 'node:assert';
import {
  BsArrayItem,
  createBsArrayKey,
  updateBsArrayOrder,
} from './helpers.js';

describe('Helpers', function () {
  it('can create a four-character, consonumeric key', function () {
    for (let i = 0; i < 10_000; i++) {
      const key = createBsArrayKey();
      ok(key.length === 4);
      ok(key.match(/^[a-z][a-z0-9]{3}$/));
    }
  });

  it('can update order fields for a BsArray', function () {
    let sorted: BsArrayItem[] = [
      { element: 'a' },
      { element: 'b', order: 3 },
      { element: 'c', order: 10 },
      { element: 'd' },
      { element: 'e', order: 7 },
      { element: 'f', order: 1 },
    ];
    updateBsArrayOrder(sorted);
    ok(sorted[0].order === -2);
    ok(sorted[1].order === 3);
    ok(sorted[2].order === 5);
    ok(sorted[3].order === 6);
    ok(sorted[4].order === 7);
    ok(sorted[5].order === 12);

    sorted = [
      { element: 'a' },
      { element: 'b' },
      { element: 'c' },
      { element: 'd' },
      { element: 'e' },
      { element: 'f' },
    ];
    updateBsArrayOrder(sorted);
    ok(sorted[0].order === 5);
    ok(sorted[1].order === 10);
    ok(sorted[2].order === 15);
    ok(sorted[3].order === 20);
    ok(sorted[4].order === 25);
    ok(sorted[5].order === 30);

    sorted = [
      { element: 'a', order: 30 },
      { element: 'b', order: 25 },
      { element: 'c', order: 20 },
      { element: 'd', order: 15 },
      { element: 'e', order: 10 },
      { element: 'f', order: 5 },
    ];
    updateBsArrayOrder(sorted);
    ok(sorted[0].order === 20);
    ok(sorted[1].order === 25);
    ok(sorted[2].order === 30);
    ok(sorted[3].order === 35);
    ok(sorted[4].order === 40);
    ok(sorted[5].order === 45);

    sorted = [
      { element: 'a' },
      { element: 'b', order: 3 },
      { element: 'c' },
      { element: 'd' },
      { element: 'e' },
      { element: 'f' },
      { element: 'g', order: 1 },
    ];
    updateBsArrayOrder(sorted);
    ok(sorted[0].order === -9);
    ok(sorted[1].order === -4);
    ok(sorted[2].order === -3);
    ok(sorted[3].order === -2);
    ok(sorted[4].order === -1);
    ok(sorted[5].order === 0);
    ok(sorted[6].order === 1);
  });
});
