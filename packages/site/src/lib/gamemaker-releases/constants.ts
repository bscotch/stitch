import type { GameMakerReleaseWithNotes } from '@bscotch/gamemaker-releases';

export type Channel = (typeof channels)[number];
export const channels = ['lts', 'stable', 'beta', 'unstable'] as const;

export function releaseAnchorId(release: GameMakerReleaseWithNotes) {
	return `release-${release.ide.version}`;
}
export function ideAnchorId(release: GameMakerReleaseWithNotes) {
	return `release-${release.ide.version}-runtime`;
}
export function runtimeAnchorId(release: GameMakerReleaseWithNotes) {
	return `release-${release.ide.version}-runtime`;
}
