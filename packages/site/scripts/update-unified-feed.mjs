/**
 * Build Stitch's unified GameMaker releases feed (and its JSON Schema)
 * into the site's static artifacts, for publishing via GitHub Pages.
 *
 * Throws if anything about GameMaker's data is unexpected, so that the
 * publish workflow can skip publishing and alert us instead.
 *
 * NOTE: The legacy feed files (`artifacts/gamemaker/releases-summary.json`
 * and `artifacts/gamemaker/release-notes-cache.json`) are frozen and
 * committed to the repo, so they are not touched here.
 */
import {
	buildReleasesFeed,
	fetchFeedSources,
	releasesFeedJsonSchema
} from '@bscotch/gamemaker-releases';
import { appendFile, mkdir, writeFile } from 'node:fs/promises';

const outDir = 'static/artifacts/gamemaker/v2';

const feed = buildReleasesFeed(await fetchFeedSources());

const summary = [
	'## GameMaker Releases Feed',
	'',
	`- Releases: ${feed.releases.length}`,
	...feed.channels.map((channel) => {
		const newest = feed.releases.find((r) => r.channels.includes(channel.name));
		return `- \`${channel.name}\` (${channel.status}): newest IDE ${newest?.version} → Runtime ${newest?.runtime.version}`;
	}),
	''
].join('\n');
console.log(summary);
if (process.env.GITHUB_STEP_SUMMARY) {
	await appendFile(process.env.GITHUB_STEP_SUMMARY, summary);
}

await mkdir(outDir, { recursive: true });
await writeFile(`${outDir}/releases.json`, JSON.stringify(feed, null, '\t'));
await writeFile(
	`${outDir}/releases.schema.json`,
	JSON.stringify(releasesFeedJsonSchema(), null, '\t')
);
console.log(`Wrote the GameMaker releases feed and schema to ${outDir}`);
