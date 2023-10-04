<script lang="ts">
	// Keep a query parameter "steamid" in sync with the steamId variable
	import { config } from '$lib/stores.js';
	import Bookmarklets from '../lib/Bookmarklets.svelte';
	import Comparisons from '../lib/Comparisons.svelte';
	import Config from '../lib/Config.svelte';
	import Footer from '../lib/Footer.svelte';
	import OtherLinks from '../lib/OtherLinks.svelte';
	import SteamUtmGenerator from '../lib/SteamUtmGenerator.svelte';
</script>

<svelte:head>
	<title>Steam Stats Portal</title>
	<meta
		name="description"
		content="Get useful tools and links to stats pages for your Steam game."
	/>
</svelte:head>

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
	This page provides a collection of useful tools and links for your Steam game. The URL stays up to
	date with the values you put into form fields, making your configuration shareable and saveable!
</p>

<Config />

<Comparisons />

<h2>Tools</h2>

<SteamUtmGenerator />

<Bookmarklets />

<OtherLinks />

<Footer />

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
</style>
