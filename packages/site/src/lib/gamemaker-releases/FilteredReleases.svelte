<script lang="ts">
	import type { ChannelInfo, GameMakerRelease } from '@bscotch/gamemaker-releases/browser';
	import Checkbox from '../Checkbox.svelte';
	import { channelColor } from './constants.js';

	export let channels: ChannelInfo[];
	export let showChannels: string[];
	export let releases: GameMakerRelease[];
	export let filteredReleases: GameMakerRelease[] = [];

	function updateFilteredReleases() {
		filteredReleases = releases.filter((release) =>
			release.channels.some((c) => showChannels.includes(c))
		);
	}

	updateFilteredReleases();
</script>

<form>
	<h2 class="sr-only">Filter display GameMaker Releases</h2>

	<fieldset>
		<legend class="sr-only"> Select which channels to display </legend>
		{#each channels as channel (channel.name)}
			<span title={channel.description}>
				<Checkbox
					label={channel.title}
					value={channel.name}
					data={{ channel: channel.name }}
					--color-checkbox-text="var(--color-background)"
					--color-checkbox-background={channelColor(channel)}
					bind:values={showChannels}
					on:change={() => {
						updateFilteredReleases();
					}}
				/>
			</span>
		{/each}
	</fieldset>
</form>

<style>
	form {
		display: flex;
		flex-direction: row;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.5em;
		font-size: 1.3rem;
	}
	form fieldset {
		display: flex;
		flex-direction: row;
		flex-wrap: wrap;
		gap: 0.25em;
		align-items: center;
		margin: 0;
		padding: 0;
		border: none;
	}

	/* https://tailwindcss.com/docs/screen-readers */
	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border-width: 0;
	}
</style>
