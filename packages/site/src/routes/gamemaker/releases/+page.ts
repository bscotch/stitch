import type { GameMakerReleaseWithNotes } from '@bscotch/gamemaker-releases';
import type { PageLoad } from './$types';

export const load = (async ({ fetch }) => {
	const releases: GameMakerReleaseWithNotes[] = await (
		await fetch('../artifacts/gamemaker/releases-summary.json')
	).json();
	return {
		releases
	};
}) satisfies PageLoad;
