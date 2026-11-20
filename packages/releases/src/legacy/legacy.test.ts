import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { fetchLegacyReleasesSummary } from './legacy.ts';

describe('Legacy releases feed', function () {
  it('is still published and matches its schema', async function () {
    // Will throw an error if invalid!
    const releases = await fetchLegacyReleasesSummary();
    assert.ok(releases.length > 0);
  });
});
