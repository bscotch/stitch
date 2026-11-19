import { describe, it } from 'node:test';
import { fetchReleasesSummaryWithNotes } from './releases.ts';

describe('Releases', function () {
  it('can download and parse a GameMaker Info release', async function () {
    // Will throw an error if invalid!
    await fetchReleasesSummaryWithNotes();
  });
});
