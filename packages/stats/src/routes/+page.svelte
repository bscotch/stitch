<script lang="ts">
	// Keep a query parameter "steamid" in sync with the steamId variable
	import { config, links } from '$lib/stores.js';
	import DateInput from '../lib/DateInput.svelte';
	import SteamUtmGenerator from '../lib/SteamUtmGenerator.svelte';
	import { steamLikesBookmarklet } from '../lib/steamLikesBookmarklet.js';

	config.init();
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

<p>
	The value provided below are used to configure the links on this page. Their values are also
	stored in the URL, so you can bookmark or share the URL for a specific configuration.
</p>

<form id="config">
	<label for="steamid"> Steam ID </label>
	<input
		name="steamid"
		type="number"
		value={$config.steamId}
		on:change={(e) => config.setField('steamId', +e.currentTarget.value)}
	/>

	<label for="fromDate"> From </label>
	<DateInput
		name="fromDate"
		date={$config.fromDate}
		on:change={(e) => config.setField('fromDate', e.detail)}
	/>

	<label for="toDate"> To </label>
	<DateInput
		name="toDate"
		date={$config.toDate}
		on:change={(e) => config.setField('toDate', e.detail)}
	/>

	<h3>Comparison Period</h3>
	<p>
		<input
			id="periods"
			type="number"
			min="1"
			value={$config.periods}
			on:change={(e) => config.setField('periods', +e.currentTarget.value)}
		/>
		periods
		<select
			value={$config.periodDirection}
			on:change={(e) => config.setField('periodDirection', e.currentTarget.value)}
		>
			<option>before</option>
			<option>after</option>
		</select>
		the given date range.
	</p>
</form>

<section>
	<h2>Ranged Data</h2>

	<p>The following links are populated using the configured Steam ID and date range.</p>

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

<h2>Tools</h2>

<SteamUtmGenerator />

<section>
	<h3>Bookmarklets</h3>

	<p>
		Install bookmarklets by dragging the link into your bookmarks toolbar. Then, when you're on a
		site that has a matching bookmarklet, just click the bookmarklet to run it!
	</p>

	<ul>
		<li>
			<a href={steamLikesBookmarklet}>Stitch:SteamLikes</a>: Adds download buttons to the Steam
			Likes plot.
		</li>
	</ul>
</section>

<h2>Other Links</h2>
<ul>
	<li>
		<a href={`https://partner.steamgames.com/apps/marketing/${$config.steamId}`}
			>Steam Marketing Portal</a
		>
		<ul>
			<li>
				<a href={`https://partner.steamgames.com/apps/navtrafficstats/${$config.steamId}`}
					>All Traffic</a
				>
			</li>
			<li>
				<a href={`https://partner.steamgames.com/apps/utmtrafficstats/${$config.steamId}`}
					>All UTM</a
				>
			</li>
			<li>
				<a href="https://partner.steampowered.com/wishlist/daily/">All Games' Wishlists</a>
			</li>
			<li>
				<a href="https://partner.steampowered.com/players.php">All Players</a>
			</li>
		</ul>
	</li>
	<li>
		<a href={`https://steamlikes.co/app/${$config.steamId}#statistics`}>Steam Likes</a>
	</li>
	<li>
		<a href={`https://steamdb.info/app/${$config.steamId}/charts/`}>SteamDB</a>
	</li>
	<li>
		<a href="https://app.sparkpost.com/signals/analytics">SparkPost</a>
	</li>
</ul>

<footer>
	<p>🔒 Private by design: no data is sent to any remote servers.</p>
	<p>
		💡 Request additional URLs or submit bug reports via <a
			href="https://github.com/bscotch/stitch/issues">GitHub Issues</a
		>
	</p>
	<p>
		💖 Created by <a href="https://www.bscotch.net/">Butterscotch Shenanigans</a>
	</p>
	<p>
		💻 See the code <a href="https://github.com/bscotch/stitch/tree/develop/packages/stats"
			>on GitHub</a
		>!
	</p>
</footer>

<style>
	#config {
		display: grid;
		grid-template-columns: max-content max-content;
		gap: 0.5rem;
		align-items: center;
	}
	#config label {
		text-align: right;
	}
	#config :where(p, h3) {
		margin: 0;
		font-size: 1rem;
		font-weight: normal;
	}
	footer {
		text-align: center;
	}
	#periods {
		max-width: 3rem;
		margin: 0 0.25rem;
		padding: 0;
	}
</style>
