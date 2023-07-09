<script lang="ts">
	import GameMakerReleases from '$lib/gamemaker-releases/GameMakerReleases.svelte';

	export let data;
</script>

<main>
	<h1>Unified GameMaker Releases Feed</h1>
	<p>
		This is an <b>unofficial</b>, unified feed combining the public release notes for all GameMaker
		releases. This feed is built automatically -- we make no guarantees about its accuracy or
		completeness.
	</p>
	<p />
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
		gap: 1rem;
	}
</style>
