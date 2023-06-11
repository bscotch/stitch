import { isBeforeRange, isInRange, ok } from './util.js';
describe('Util', function () {
  it('can determine if a position is within a range', function () {
    const range = {
      start: { line: 10, column: 6, offset: 331 },
      end: { line: 17, column: 3, offset: 500 },
    };
    ok(!isInRange(range, { line: 9, column: 1 }));

    ok(isInRange(range, { line: 10, column: 6 }));
    ok(isInRange(range, { line: 10, column: 7 }));
    ok(!isInRange(range, { line: 10, column: 5 }));

    ok(isInRange(range, { line: 11, column: 1 }));
    ok(isInRange(range, { line: 11, column: 10 }));

    ok(isInRange(range, { line: 17, column: 1 }));
    ok(isInRange(range, { line: 17, column: 3 }));
    ok(!isInRange(range, { line: 17, column: 4 }));

    ok(!isInRange(range, { line: 18, column: 1 }));
  });

  it('can determine if a position is within a single line range', function () {
    const range = {
      start: { line: 10, column: 6, offset: 331 },
      end: { line: 10, column: 10, offset: 335 },
    };
    ok(!isInRange(range, { line: 9, column: 1 }));
    ok(!isInRange(range, { line: 11, column: 1 }));
    ok(!isInRange(range, { line: 10, column: 5 }));
    ok(!isInRange(range, { line: 10, column: 11 }));
    ok(isInRange(range, { line: 10, column: 6 }));
    ok(isInRange(range, { line: 10, column: 7 }));
    ok(isInRange(range, { line: 10, column: 10 }));
  });

  it('can determine if a position is before a range', function () {
    const range = {
      start: { line: 10, column: 6, offset: 331 },
      end: { line: 17, column: 3, offset: 500 },
    };
    ok(isBeforeRange(range, { line: 9, column: 1 }));
    ok(isBeforeRange(range, { line: 10, column: 5 }));
    ok(!isBeforeRange(range, { line: 10, column: 6 }));

    ok(!isBeforeRange(range, { line: 11, column: 1 }));
    ok(!isBeforeRange(range, { line: 17, column: 1 }));
    ok(!isBeforeRange(range, { line: 20, column: 3 }));
  });
});
