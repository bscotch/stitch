import type { ChannelInfo, GameMakerRelease } from '@bscotch/gamemaker-releases/browser';

/** localStorage key for the viewer's selected channels */
export const channelsStorageKey = 'feed-channels-v2';

export function releaseAnchorId(release: GameMakerRelease) {
	return `release-${release.version}`;
}

/** CSS color for a channel, based on its kind so that new channels "just work" */
export function channelColor(channel: Pick<ChannelInfo, 'kind'> | undefined) {
	const colorName =
		channel?.kind === 'lts'
			? 'lts'
			: channel?.kind === 'monthly'
				? 'stable'
				: channel?.kind === 'beta'
					? 'beta'
					: 'unstable';
	return `var(--color-channel-${colorName})`;
}

/** By default, show all but the unstable-kind channels */
export function defaultChannelNames(channels: ChannelInfo[]): string[] {
	return channels.filter((c) => c.kind !== 'unstable').map((c) => c.name);
}
