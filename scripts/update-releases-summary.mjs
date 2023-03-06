import { pathy } from '@bscotch/pathy';
import { computeReleasesSummaryWithNotes } from '../packages/releases/dist/index.js';
import fs from 'fs';

const notesCache = pathy('packages/releases/release-notes-cache.json');
const summaryPath = pathy('packages/releases/releases-summary.json');
const releases = await computeReleasesSummaryWithNotes(undefined, notesCache);
await summaryPath.write(releases);
// Write to the file that GitHub Workflow uses to store env vars
fs.appendFileSync(
  /** @type {string} */
  (process.env.GITHUB_ENV),
  `LATEST_RELEASE=${releases[0].ide.version}`,
);
console.log(releases[0].ide.version);
