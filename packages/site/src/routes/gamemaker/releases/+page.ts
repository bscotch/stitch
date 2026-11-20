import type { GameMakerReleasesFeed } from '@bscotch/gamemaker-releases/browser';
import type { PageLoad } from './$types';

export const load = (async ({ fetch }) => {
	const feed: GameMakerReleasesFeed = await (
		await fetch('../artifacts/gamemaker/v2/releases.json')
	).json();
	return {
		channels: feed.channels,
		releases: feed.releases
	};
}) satisfies PageLoad;
