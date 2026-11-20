import { z } from 'zod';
import { fetchJson } from '../fetch.ts';
import { gameMakerReleaseWithNotesSchema } from './schemas.ts';

/**
 * URL of the *legacy* GameMaker releases summary feed. Its content is
 * frozen: it is still served for backwards compatibility with older
 * versions of Stitch, but it no longer receives new GameMaker releases.
 * @deprecated Use {@link releasesUrl} (the v2 feed) instead.
 */
export const legacyReleasesUrl =
  'https://bscotch.github.io/stitch/artifacts/gamemaker/releases-summary.json';

/**
 * Download and validate the *legacy* (frozen) releases summary feed.
 * @deprecated Use {@link fetchReleasesFeed} (the v2 feed) instead.
 */
export async function fetchLegacyReleasesSummary(url = legacyReleasesUrl) {
  return await fetchJson(url, z.array(gameMakerReleaseWithNotesSchema));
}
