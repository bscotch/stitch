<script lang="ts">
	import GameMakerReleases from '$lib/gamemaker-releases/GameMakerReleases.svelte';
	import { faCircleExclamation } from '@fortawesome/free-solid-svg-icons';
	import Fa from 'svelte-fa';

	export let data;
</script>

<main>
	<h1>Unified GameMaker Releases Feed</h1>
	<p>
		This is an <b>unofficial</b>, unified feed combining the public release notes for all
		<a href="https://gamemaker.io">GameMaker</a> Windows releases.
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
