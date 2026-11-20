/**
 * @file Exports for working with the *legacy* (frozen) GameMaker releases
 * summary feed. Browser-compatible.
 * @deprecated Use the v2 feed (the package's main exports) instead.
 */
export { fetchLegacyReleasesSummary, legacyReleasesUrl } from './legacy.ts';
export { gameMakerReleaseWithNotesSchema } from './schemas.ts';
export type {
  ArtifactType,
  Channel,
  GameMakerRelease,
  GameMakerReleaseWithNotes,
} from './schemas.ts';
export { ideFeedUrls, runtimeFeedUrls } from './urls.ts';
