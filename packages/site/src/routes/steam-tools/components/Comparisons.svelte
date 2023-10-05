<script lang="ts">
	// Keep a query parameter "steamid" in sync with the steamId variable
	import { links } from '../lib/stores.js';
	import SteamTrafficComparison from './SteamTrafficComparison.svelte';
</script>

<section>
	<h2>Comparisons</h2>

	<p>
		The following links are populated using the configured Steam ID and date range, making it easy
		to compare a time period to a reference period.
	</p>

	<ul>
		<li>
			<a href={$links.steamTrafficLink} target="_blank"> Steam Traffic </a>
			&nbsp; (<a href={$links.steamTrafficComparisonLink} target="_blank">comparison</a>)
		</li>
		<li>
			<a href={$links.steamUtmLink} target="_blank"> Steam UTM </a> &nbsp; (<a
				href={$links.steamUtmComparisonLink}
				target="_blank">comparison</a
			>)
		</li>
		<li>
			<a href={$links.steamWishlistsLink} target="_blank"> Steam Wishlists </a>
			&nbsp; (<a href={$links.steamWishlistsComparisonLink} target="_blank">comparison</a>)
		</li>
		<li>
			<a href={$links.steamPlayersLink} target="_blank"> Steam Players </a>
			&nbsp; (<a href={$links.steamPlayersComparisonLink} target="_blank">comparison</a>)
		</li>
		<li>
			<a href={$links.steamRegionsLink} target="_blank"> Steam Regions &amp; Countries </a>
			&nbsp; (<a href={$links.steamRegionsComparisonLink} target="_blank">comparison</a>)
		</li>
	</ul>

	<SteamTrafficComparison />
</section>

<style>
	section {
		display: flex;
		flex-direction: column;
		gap: 1em;
	}
</style>
