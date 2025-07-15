<script lang="ts">
	import GameMakerReleases from '$lib/gamemaker-releases/GameMakerReleases.svelte';
	import { faCircleExclamation } from '@fortawesome/free-solid-svg-icons';
	import Fa from 'svelte-fa';

	export let data;
</script>

<svelte:head>
	<title>Unified GameMaker Version History | Stitch | Butterscotch Shenanigans</title>
	<meta
		name="description"
		content="All GameMaker IDE and Runtime releases merged into a single feed."
	/>
</svelte:head>

<main>
	<h1>Unified GameMaker Releases Feed</h1>
	<p>
		This is an <b>unofficial</b>, unified feed combining the public release history for all
		<a href="https://gamemaker.io">GameMaker</a> Windows Runtime and IDE releases.
	</p>
	<p>
		To get this feed as a JSON file for use in your own applications, you can download it <a
			href="https://bscotch.github.io/stitch/artifacts/gamemaker/releases-summary.json">here</a
		>.
	</p>
	<p>
		For release <i>notes</i>, refer to the
		<a href="https://releases.gamemaker.io/">official GameMaker documentation</a>.
	</p>
	<p style="font-style:italic;color:var(--color-text-subtle);">
		<span class="warn">
			<Fa icon={faCircleExclamation} size="sm" />
			WARNING
			<Fa icon={faCircleExclamation} size="sm" />
		</span>
		This page is automatically generated and may be incomplete or contain errors. Refer to the official
		GameMaker release notes for the most accurate information.
	</p>
	<div>
		<GameMakerReleases releases={data.releases} />
	</div>
</main>

<style>
	main {
		display: flex;
		flex-direction: column;
		width: 100%;
		max-width: 50rem;
		padding-top: 2rem;
		gap: 1.25rem;
	}
	.warn {
		color: var(--color-text-danger);
		font-weight: bold;
		font-style: normal;
	}
</style>
