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
</svelte:head>

<h1>
	{$config.steamId} | Steam Tools Portal
</h1>

<p>
	Get links to useful stats pages for a given Steam game and date range. In general these links will
	only work if you are logged into Steam and have appropriate access.
</p>

<Config />

<Comparisons />

<h2>Tools</h2>

<SteamUtmGenerator />

<Bookmarklets />

<OtherLinks />

<Footer />
