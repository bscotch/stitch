import { fetchReleasesSummaryWithNotes } from './releases.js';

describe('Releases', function () {
  it('can download and parse a GameMaker Info release', async function () {
    // Will throw an error if invalid!
    await fetchReleasesSummaryWithNotes();
  });
});
