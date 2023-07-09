<script lang="ts">
	import type { GameMakerReleaseWithNotes } from '@bscotch/gamemaker-releases';
	import { faDownload } from '@fortawesome/free-solid-svg-icons';
	import Fa from 'svelte-fa';
	import { toDateIso, toDateLocal } from '../util.js';
	import FilteredReleases from './FilteredReleases.svelte';
	import NoteGroup from './NoteGroup.svelte';
	import ReleaseVersion from './ReleaseVersion.svelte';
	import { ideAnchorId, releaseAnchorId, runtimeAnchorId, type Channel } from './constants.js';

	export let showChannels: Channel[] = ['lts', 'stable', 'beta'];
	export let releases: GameMakerReleaseWithNotes[];

	// We only want to show the download button for Windows clients.
	const onWindows = navigator.userAgent.includes('Windows');

	let filteredReleases: GameMakerReleaseWithNotes[] = [];
</script>

<section id="gamemaker-releases-component">
	<FilteredReleases bind:showChannels bind:releases bind:filteredReleases />

	{#each filteredReleases as release}
		<article class="release" data-version={release.ide.version} data-channel={release.channel}>
			<header>
				<h2
					id={releaseAnchorId(release)}
					title={`Release ${release.ide.version} (${release.channel} channel)`}
				>
					<span class="versions">
						<span class="ide">
							{#if onWindows && release.ide.link}
								<a
									href={release.ide.link}
									class="download-link"
									title="Download"
									target="_blank"
									rel="noopener"
								>
									<Fa icon={faDownload} size="sm" />
								</a>
							{/if}
							{release.ide.version}
							<span class="label">(IDE)</span>
						</span>
						<span class="runtime">
							{release.runtime.version}
							<span class="label">(Runtime)</span>
						</span>
					</span>
				</h2>

				<time datetime={toDateIso(release.publishedAt)}>
					<span class="sr-only">Release Date:</span>
					{toDateLocal(release.publishedAt)}
				</time>
			</header>
			<details>
				<summary><h3>Summary</h3></summary>
				<section class="release-summary">
					{@html release.summary}
				</section>
			</details>
			{#if release.runtime.notes.groups.length}
				<details>
					<summary>
						<h3 id={runtimeAnchorId(release)}>Runtime Changes</h3>
					</summary>
					<section>
						<ReleaseVersion artifact={release.runtime} />
						{#each release.runtime.notes.groups as group}
							<NoteGroup {group} />
						{/each}
					</section>
				</details>
			{/if}
			{#if release.ide.notes.groups.length}
				<details>
					<summary>
						<h3 id={ideAnchorId(release)}>IDE Changes</h3>
					</summary>
					<section>
						<ReleaseVersion artifact={release.ide} />
						{#each release.ide.notes.groups as group}
							<NoteGroup {group} />
						{/each}
					</section>
				</details>
			{/if}
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
	/* CHANNEL PILLS */
	[data-channel='lts'] {
		--channel-color: var(--color-channel-lts);
	}
	[data-channel='stable'] {
		--channel-color: var(--color-channel-stable);
	}
	[data-channel='beta'] {
		--channel-color: var(--color-channel-beta);
	}
	[data-channel='unstable'] {
		--channel-color: var(--color-channel-unstable);
	}

	/* article header h2 .versions .runtime {
    font-size: 0.8em;
    color: var(--color-text-subtle);
  } */

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

	details summary {
		cursor: pointer;
		font-size: 1em;
	}
	details summary h3 {
		font-size: 1em;
		user-select: none;
		display: inline;
	}
	details > section {
		padding-left: 1em;
		padding-block: 0 0.75em;
	}
	details > section.release-summary {
		display: flex;
		flex-direction: column;
		gap: 0.5em;
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
