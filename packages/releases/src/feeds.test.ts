import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { pathy } from '@bscotch/pathy';
import {
  computeReleasesSummary,
  computeReleasesSummaryWithNotes,
} from './feeds.ts';
import { rawReleaseNotesCacheSchema } from './feeds.types.ts';
import { cleanNote } from './notes.ts';

const notesCache = pathy('release-notes-cache.json').withValidator(
  rawReleaseNotesCacheSchema,
);
const tmpSummaryPath = pathy('releases-summary.json');

const sampleReleaseNotesPath = pathy('samples/release_notes.json');

describe('Release Feeds', function () {
  it('can parse runtime release_notes HTML', async function () {
    const notes = (await sampleReleaseNotesPath.read()) as {
      release_notes: string[];
    };
    const cleaned = cleanNote({
      type: 'runtime',
      version: '2022.1100.0.259',
      url: 'https://gms.yoyogames.com/release-notes-2022.1100.0.259.json',
      ...notes,
    });
    assert.equal(cleaned.title, 'Changes Since Beta Runtime 258');
    assert.ok(cleaned.changes.groups != null);
    assert.ok(cleaned.changes.groups.length > 0);
    assert.equal(cleaned.changes.since, '258');
    assert.equal(cleaned.changes.groups[0].title, 'Other Bugs Fixed');
    assert.equal(cleaned.changes.groups[0].changes.length, 2);
  });

  it(
    'can create a centralized GameMaker Releases database',
    {
      // Without a local notes cache this makes hundreds of requests to
      // GameMaker's servers and takes minutes. The scheduled releases-summary
      // job exercises this code in production.
      skip: process.env.CI ? 'Too slow and network-heavy for CI' : false,
    },
    async function () {
      const releases = await computeReleasesSummary();
      const withNotes = await computeReleasesSummaryWithNotes(
        releases,
        notesCache,
      );
      await tmpSummaryPath.write(withNotes);
      assert.ok(withNotes.length > 0);
      assert.ok(withNotes.every((r) => r.channel) != null);
      for (const type of ['ide', 'runtime'] as const) {
        assert.ok(withNotes.every((r) => r[type]) != null);
        assert.ok(withNotes.every((r) => r[type].version) != null);
        assert.ok(withNotes.every((r) => r[type].notes) != null);
        assert.ok(withNotes.every((r) => r[type].notes.groups) != null);
      }
      const sampleRelease = withNotes.find(
        (r) => r.runtime.version === '2022.0.1.30',
      )!;
      assert.ok(sampleRelease != null);
      assert.ok(sampleRelease.runtime.notes.groups != null);
      assert.ok(sampleRelease.runtime.notes.groups.length > 0);
    },
  );
});
