/**
 * Regression tests against the golden snapshot recorded from the old
 * `@bscotch/gml-parser` (`node scripts/compare-snapshot.ts` prints
 * the full comparison for review).
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { compareWithOldSnapshot } from './snapshot.compare.ts';

describe('Old parser snapshot', function () {
  it('resolves every reference to the same declaration', async function () {
    const { counts, completionReport } = await compareWithOldSnapshot();
    assert.equal(counts.differentTarget, 0);
    // Other differences (new references, narrower spans) are intended and
    // reviewed with `node scripts/compare-snapshot.ts`
    assert.ok(counts.same > 950, `Only ${counts.same} references match`);
    assert.deepEqual(completionReport, []);
  });
});
