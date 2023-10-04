<script lang="ts">
	// Keep a query parameter "steamid" in sync with the steamId variable
	import { links } from '$lib/stores.js';
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
			&nbsp; (<a href={$links.comparisonSteamTrafficLink} target="_blank">comparison</a>)
		</li>
		<li>
			<a href={$links.steamUtmLink} target="_blank"> Steam UTM </a> &nbsp; (<a
				href={$links.comparisonSteamUtmLink}
				target="_blank">comparison</a
			>)
		</li>
		<li>
			<a href={$links.steamWishlistsLink} target="_blank"> Steam Wishlists </a>
			&nbsp; (<a href={$links.comparisonSteamWishlistsLink} target="_blank">comparison</a>)
		</li>
		<li>
			<a href={$links.steamPlayersLink} target="_blank"> Steam Players </a>
			&nbsp; (<a href={$links.comparisonSteamPlayersLink} target="_blank">comparison</a>)
		</li>
	</ul>
</section>
