<script lang="ts">
	// Keep a query parameter "steamid" in sync with the steamId variable
	import Bookmarklets from './components/Bookmarklets.svelte';
	import Comparisons from './components/Comparisons.svelte';
	import Config from './components/Config.svelte';
	import Footer from './components/Footer.svelte';
	import OtherLinks from './components/OtherLinks.svelte';
	import SteamUtmGenerator from './components/SteamUtmGenerator.svelte';
	import { config } from './lib/stores.js';
</script>

<svelte:head>
	<title>Steam Stats Portal</title>
	<meta
		name="description"
		content="Get useful tools and links to stats pages for your Steam game."
	/>
</svelte:head>

<main>
	<h1>
		{$config.steamId} | Steam Tools Portal
	</h1>

	<p id="support-banner">
		💖 Support this project by <a
			href="https://store.steampowered.com/app/1401730?utm_source=stitch-steam-stats&utm_term=tools&utm_content=support-cta"
			>wishlisting Crashlands 2</a
		>! 💖
	</p>

	<p>
		This page provides a collection of useful tools and links for your Steam game. The URL stays up
		to date with the values you put into form fields, making your configuration shareable and
		saveable!
	</p>

	<Config />

	<Comparisons />

	<h2>Tools</h2>

	<SteamUtmGenerator />

	<Bookmarklets />

	<OtherLinks />

	<Footer />
</main>

<style>
	h1 {
		text-align: center;
	}
	#support-banner {
		border: 0.1em solid var(--color-text);
		text-align: center;
		padding: 0.5em 1em;
		font-size: 1.2em;
	}
	main {
		--color-result: var(--color-logo-yellow);
		width: 100%;
		max-width: 720px;
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}
</style>
