import { fetchJson } from './fetch.ts';
import { releasesFeedSchema } from './schemas.ts';

const artifactsUrl = 'https://bscotch.github.io/stitch/artifacts/gamemaker';

/**
 * URL of Stitch's unified (v2) GameMaker releases feed, which is
 * regenerated from GameMaker's data every weekday.
 */
export const releasesUrl = `${artifactsUrl}/v2/releases.json`;

/** URL of the JSON Schema for the releases feed at {@link releasesUrl}. */
export const releasesSchemaUrl = `${artifactsUrl}/v2/releases.schema.json`;

/** Download and validate Stitch's unified GameMaker releases feed. */
export async function fetchReleasesFeed(url = releasesUrl) {
  return await fetchJson(url, releasesFeedSchema);
}
