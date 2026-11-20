<script lang="ts">
	/* eslint-disable svelte/no-navigation-without-resolve -- Download links here are external GameMaker URLs, not app routes */
	import type {
		ChannelInfo,
		GameMakerRelease,
		Platform
	} from '@bscotch/gamemaker-releases/browser';
	import { faDownload } from '@fortawesome/free-solid-svg-icons';
	import { onMount } from 'svelte';
	import Fa from 'svelte-fa';
	import { loadProperty, saveProperty, toDateIso, toDateLocal } from '../util.js';
	import FilteredReleases from './FilteredReleases.svelte';
	import {
		channelColor,
		channelsStorageKey as storageKey,
		defaultChannelNames,
		releaseAnchorId
	} from './constants.js';

	export let channels: ChannelInfo[];
	export let releases: GameMakerRelease[];
	export let showChannels: string[] = loadChannelPreference();

	// Only show download buttons for the viewer's platform
	let platform: Platform | undefined;

	let filteredReleases: GameMakerRelease[] = [];

	function loadChannelPreference(): string[] {
		const known = channels.map((c) => c.name);
		let stored: string[] = loadProperty(storageKey, []);
		stored = Array.isArray(stored) ? stored.filter((name) => known.includes(name)) : [];
		return stored.length ? stored : defaultChannelNames(channels);
	}

	function channelInfo(name: string) {
		return channels.find((c) => c.name === name);
	}

	onMount(() => {
		const agent = navigator.userAgent;
		platform = agent.includes('Windows')
			? 'windows'
			: agent.includes('Mac')
				? 'mac'
				: agent.includes('Linux')
					? 'linux'
					: undefined;
	});

	$: {
		saveProperty(storageKey, showChannels);
	}
</script>

<section id="gamemaker-releases-component">
	<FilteredReleases {channels} bind:showChannels bind:releases bind:filteredReleases />

	{#each filteredReleases as release (release.version)}
		{@const download = platform && release.downloads[platform]}
		<article
			class="release"
			data-version={release.version}
			data-channel={release.channels[0]}
			style:--channel-color={channelColor(channelInfo(release.channels[0]))}
		>
			<header>
				<h2
					id={releaseAnchorId(release)}
					title={`Release ${release.version} (${release.channels.join(', ')})`}
				>
					<span class="versions">
						<span class="ide">
							{#if download}
								<a
									href={download}
									class="download-link"
									title="Download"
									target="_blank"
									rel="noopener"
								>
									<Fa icon={faDownload} size="sm" />
								</a>
							{/if}
							{release.version}
							<span class="label">(IDE)</span>
						</span>
						<span class="runtime">
							{release.runtime.version}
							<span class="label">(Runtime)</span>
						</span>
						<span class="label">
							{release.channels.map((c) => channelInfo(c)?.title ?? c).join(', ')}
						</span>
					</span>
				</h2>

				<time datetime={toDateIso(release.publishedAt)}>
					<span class="sr-only">Release Date:</span>
					{toDateLocal(release.publishedAt)}
				</time>
			</header>
		</article>
	{/each}
</section>

<style>
	#gamemaker-releases-component {
		font-size: 1.1em;
		color: var(--color-text);
		display: flex;
		flex-direction: column;
		gap: 2em;
	}

	/* RELEASE */

	article header {
		display: grid;
		grid-template-columns: 1fr 5.5em;
		gap: 0.5em;
		align-items: center;
	}

	.download-link {
		color: var(--color-text-subtle);
		margin-right: 0.25em;
	}
	.download-link:hover {
		color: var(--color-link-hover);
	}

	article header h2 {
		color: var(--channel-color);
		font-size: 1.3em;
		display: inline-flex;
		align-items: center;
		gap: 0.5em;
	}

	article header h2 .versions {
		display: flex;
		flex-direction: column;
		gap: 0.1em;
		line-height: 1em;
	}

	article header h2 .versions .label {
		font-size: 0.8em;
		color: var(--color-text-quiet);
		/* font-weight: 400; */
		/* font-style: italic; */
	}

	article header h2 .versions .runtime {
		font-size: 0.8em;
		color: var(--color-text-subtle);
	}

	article header time {
		color: var(--color-text-subtle);
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
