import { Pathy } from '@bscotch/pathy';
import { z } from 'zod';
import { defaultNotesCachePath } from './constants.js';
import { downloadRssFeed, findPairedRuntime } from './feeds.lib.js';
import {
  ArtifactType,
  GameMakerArtifact,
  GameMakerRelease,
  GameMakerReleaseWithNotes,
  channels,
  gameMakerArtifactSchema,
  gameMakerReleaseSchema,
  gameMakerReleaseWithNotesSchema,
} from './feeds.types.js';
import { listReleaseNotes } from './notes.js';
import { ideFeedUrls, runtimeFeedUrls } from './urls.js';

export async function computeReleasesSummaryWithNotes(
  releases?: GameMakerRelease[],
  cache: Pathy | string = defaultNotesCachePath,
): Promise<GameMakerReleaseWithNotes[]> {
  releases ||= await computeReleasesSummary();
  const notes = await listReleaseNotes(releases, cache);
  const withNotes: GameMakerReleaseWithNotes[] = [];
  const emptyChanges = {
    changes: {
      since: null,
      groups: [],
    },
  };
  for (const release of releases) {
    const ideNotes = notes[release.ide.notesUrl] || emptyChanges;
    const runtimeNotes = notes[release.runtime.notesUrl] || emptyChanges;
    const ide = { ...release.ide, notes: ideNotes.changes };
    const runtime = { ...release.runtime, notes: runtimeNotes.changes };
    withNotes.push({
      channel: release.channel,
      summary: release.summary,
      publishedAt: release.publishedAt,
      ide,
      runtime,
    });
  }
  withNotes.sort(
    (a, b) =>
      new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime(),
  );
  return z.array(gameMakerReleaseWithNotesSchema).parse(withNotes);
}

export async function computeReleasesSummary(): Promise<GameMakerRelease[]> {
  const ideArtifacts = await listArtifacts('ide');
  const runtimeArtifacts = await listArtifacts('runtime');
  const releases: GameMakerRelease[] = [];
  for (let i = 0; i < ideArtifacts.length; i++) {
    const ide = ideArtifacts[i];
    if (!ide.publishedAt) {
      continue;
    }
    const runtime = findPairedRuntime(runtimeArtifacts, ide);
    if (!runtime) {
      continue;
    }
    releases.push({
      channel: ide.channel,
      summary: ide.summary!,
      publishedAt: ide.publishedAt,
      ide,
      runtime,
    });
  }
  releases.sort(
    (a, b) =>
      new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime(),
  );
  return z.array(gameMakerReleaseSchema).parse(releases);
}

async function listArtifacts(type: ArtifactType): Promise<GameMakerArtifact[]> {
  const entries: GameMakerArtifact[] = [];
  const urls = type === 'ide' ? ideFeedUrls() : runtimeFeedUrls();
  const feeds = await Promise.all(
    channels.map((channel) => downloadRssFeed(urls[channel])),
  );
  for (let i = 0; i < channels.length; i++) {
    const channel = channels[i];
    const feed = feeds[i];
    for (const entry of feed) {
      entries.push(
        gameMakerArtifactSchema.parse({
          type,
          channel,
          publishedAt: entry.pubDate,
          version: entry.title.match(/^Version (.*)/)![1],
          link: entry.link,
          feedUrl: urls[channel],
          summary: entry.description,
          notesUrl: entry.comments,
        }),
      );
    }
  }
  entries.sort(
    (a, b) =>
      new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime(),
  );
  return entries;
}
