import { pathy } from '@bscotch/pathy';
import { expect } from 'chai';
import { cleanNote } from './notes.js';
import {
  computeReleasesSummary,
  computeReleasesSummaryWithNotes,
} from './feeds.js';
import { rawReleaseNotesCacheSchema } from './feeds.types.js';

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
    expect(cleaned.title).to.equal('Changes Since Beta Runtime 258');
    expect(cleaned.changes.groups).to.exist;
    expect(cleaned.changes.groups.length).to.be.greaterThan(0);
    expect(cleaned.changes.since).to.equal('258');
    expect(cleaned.changes.groups[0].title).to.equal('Other Bugs Fixed');
    expect(cleaned.changes.groups[0].changes.length).to.equal(2);
  });

  it('can create a centralized GameMaker Releases database', async function () {
    const releases = await computeReleasesSummary();
    const withNotes = await computeReleasesSummaryWithNotes(
      releases,
      notesCache,
    );
    await tmpSummaryPath.write(withNotes);
    expect(withNotes.length).to.be.greaterThan(0);
    expect(withNotes.every((r) => r.channel)).to.exist;
    for (const type of ['ide', 'runtime'] as const) {
      expect(withNotes.every((r) => r[type])).to.exist;
      expect(withNotes.every((r) => r[type].version)).to.exist;
      expect(withNotes.every((r) => r[type].notes)).to.exist;
      expect(withNotes.every((r) => r[type].notes.groups)).to.exist;
    }
    const sampleRelease = withNotes.find(
      (r) => r.runtime.version === '2022.1100.0.259',
    )!;
    expect(sampleRelease.runtime.notes.groups).to.exist;
    expect(sampleRelease.runtime.notes.groups.length).to.be.greaterThan(0);
  });
});
