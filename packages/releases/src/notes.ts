import { Pathy } from '@bscotch/pathy';
import { assert } from '@bscotch/utility/browser';
import { defaultNotesCachePath } from './constants.js';
import {
  ArtifactType,
  GameMakerRelease,
  RawReleaseNotesCache,
  rawReleaseNotesCacheSchema,
  rawReleaseNoteSchema,
} from './feeds.types.js';
import { fetchJson } from './fetch.js';
import { countNonUnique, findMax } from './utils.js';

export async function listReleaseNotes(
  releases: GameMakerRelease[],
  cache: Pathy | string = defaultNotesCachePath,
) {
  const cachePath = Pathy.asInstance(cache).withValidator(
    rawReleaseNotesCacheSchema,
  );
  assert(
    cachePath.hasExtension('json'),
    `Cache path must have a .json extension`,
  );
  const cacheData = await cachePath.read({ fallback: {} });
  for (const release of releases) {
    for (const type of ['ide', 'runtime'] as const) {
      const url = release[type].notesUrl;
      if (cacheData[url]) {
        if (!cacheData[url].type) {
          cacheData[url].type = type;
          await cachePath.write(cacheData);
        }
        continue;
      }
      console.info('Notes cache miss:', url);
      const note = await fetchJson(url, rawReleaseNoteSchema);
      cacheData[url] = {
        type,
        ...rawReleaseNoteSchema.parse(note),
      };
      await cachePath.write(cacheData);
    }
  }
  return cleanNotes(cacheData);
}

function cleanNotes(cachedNotes: RawReleaseNotesCache) {
  const rawNotes = Object.entries(cachedNotes).map(([url, note]) => ({
    ...note,
    url,
  }));
  // As of writing, all versions from downloaded notes are unique.
  // We'll assume that moving forward, but also throw if that assumption is broken.
  const versions = rawNotes.map((note) => `${note.version} (${note.type})`);
  assert(
    countNonUnique(versions) === 0,
    `Duplicate versions found in release notes`,
  );
  // Convert each note into a well-defined structured document.
  const cleanedNotes = rawNotes.map(cleanNote);
  // Try to normalize "since" versions, since they're often only the *last* digits
  for (const note of cleanedNotes) {
    if (!note.changes.since?.match(/^\d+$/)) {
      continue;
    }
    const possibleMatches = versions.filter((v) =>
      v.endsWith(`.${note.changes.since}`),
    );
    if (possibleMatches.length === 1) {
      note.changes.since = possibleMatches[0];
      continue;
    }
    if (!possibleMatches.length) {
      // Then just replace the current version with those digits
      note.changes.since = note.version.replace(/\d+$/, note.changes.since);
      continue;
    }
    // Score matches by digits in common
    const versionParts = note.version.split('.');
    note.changes.since = findMax(possibleMatches, (possibleMatch) => {
      const matchParts = possibleMatch.split('.');
      let score = 0;
      for (let j = 0; j < matchParts.length; j++) {
        score += matchParts[j] === versionParts[j] ? 1 : 0;
      }
      return score;
    });
  }
  // Re-organize into a map for indexing by notes-URL, so that these can be merged
  // into the release feed data.
  const notesByUrl = cleanedNotes.reduce((acc, note) => {
    acc[note.url] = note;
    return acc;
  }, {} as Record<string, typeof cleanedNotes[0]>);
  return notesByUrl;
}

export function cleanNote(note: {
  type?: ArtifactType;
  version: string;
  url: string;
  release_notes: string[];
}) {
  assert(note.type, 'Note type must be set');
  const { body, title } = parseHeader(note.release_notes.join(''));
  const groups = parseBody(body);
  const sinceVersion = relativeToVersion(title);

  // Normalize the HTML
  return {
    version: note.version,
    url: note.url,
    title,
    type: note.type,
    changes: {
      since: sinceVersion,
      groups,
    },
  };
}

function relativeToVersion(title: string | null): string | null {
  if (!title) {
    return null;
  }
  const sinceMatch = title.match(/([0-9.]+)/i);
  return sinceMatch?.[1] || null;
}

function parseBody(html: string) {
  // Split on h3 elements, and then pull out the lists within each
  const parts = html.split(/<h3>\s*(.+?)\s*<\/h3>\s*<ul>\s*(.+?)\s*<\/ul>/gs);
  const changes: { title: string; changes: string[] }[] = [];
  for (let groupIdx = 0; groupIdx < parts.length - 2; groupIdx += 3) {
    const [title, list] = [parts[groupIdx + 1], parts[groupIdx + 2]];
    changes.push({ title, changes: parseList(list) });
  }
  return changes;
}

function parseList(htmlList: string) {
  const parts = htmlList.split(/<li>\s*(.+?)\s*<\/li>/gs);
  const changes: string[] = [];
  for (let groupIdx = 0; groupIdx < parts.length - 1; groupIdx += 2) {
    const change = parts[groupIdx + 1];
    changes.push(change);
  }
  return changes;
}

function parseHeader(html: string): { title: string | null; body: string } {
  // Remove changelogs from other versions (if there are additional h2 headings, remove
  // those and all below them)
  html = html.trim();
  // If there is an h2 with the word "since" in it (otherwise the first h2), treat that
  // one as the one describing this version and remove everything above and all headers
  // below it.
  const h2s = html.match(/<h2>\s*(.+?)\s*<\/h2>/gs);
  if (!h2s?.length) {
    return { title: null, body: html };
  }
  const thisVersionH2 = h2s.find((h2) => h2.match(/\bsince\b/i)) || h2s[0];
  let [, after] = html.split(thisVersionH2);
  const firstH2Index = after.indexOf('<h2>');
  if (firstH2Index > 0) {
    after = after.slice(0, firstH2Index);
  }
  assert(!after.includes('<h2>'), `Somehow still has an h2 after parsing`);
  const [, title] = thisVersionH2.match(/^<h2>\s*(?<title>.+?)\s*<\/h2>/ms)!;
  return { title, body: after };
}
