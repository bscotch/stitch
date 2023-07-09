import { computeReleasesSummaryWithNotes } from '@bscotch/gamemaker-releases';
import { pathy } from '@bscotch/pathy';
import fetch from 'node-fetch';

// UPDATE GAMEMAKER RELEASES SUMMARY
const artifactsDir = pathy('static/artifacts/gamemaker');
await artifactsDir.ensureDirectory();

const notesCache = artifactsDir.join('release-notes-cache.json');
const summaryPath = artifactsDir.join('releases-summary.json');

// Download the latest cache to reduce calls and speed up the process.
const cache = await (
	await fetch('https://bscotch.github.io/stitch/artifacts/gamemaker/release-notes-cache.json')
).json();
await notesCache.write(cache);

/** @type {boolean} */
let b = false;

if (b) {
	const releases = await computeReleasesSummaryWithNotes(undefined, notesCache);
	await summaryPath.write(releases);
	console.log('Latest GameMaker IDE:', releases[0].ide.version);
}
