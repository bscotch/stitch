import { $ } from 'zx';
import { pathy } from '@bscotch/pathy';
import { computeReleasesSummaryWithNotes } from '../../releases/dist/index.js';

// UPDATE GAMEMAKER RELEASES SUMMARY
const artifactsDir = pathy('static/artifacts/gamemaker');
await artifactsDir.ensureDirectory();

const notesCache = artifactsDir.join('release-notes-cache.json');
const summaryPath = artifactsDir.join('releases-summary.json');

const releases = await computeReleasesSummaryWithNotes(undefined, notesCache);
await summaryPath.write(releases);
console.log('Latest GameMaker IDE:',releases[0].ide.version);


// COLLECT INFO
const hash = await stdout($`git rev-parse HEAD`);
const message = await stdout($`git log -1 --pretty=%B`);

// UPDATE THE BUILD
await $`pnpm build`;

// PUBLISH

await $`pnpm wrangler pages deploy ./.svelte-kit/cloudflare --project-name=stitch --branch=develop --commit-message=${message} --commit-hash=${hash}`;

/** @param {import('zx').ProcessPromise} call */
async function stdout(call) {
	return (await call).stdout.trim();
}