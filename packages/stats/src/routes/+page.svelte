<script lang="ts">
	import { browser } from '$app/environment';
	import { goto } from '$app/navigation';
	// Keep a query parameter "steamid" in sync with the steamId variable
	import { page } from '$app/stores';
	import DateInput from '../lib/DateInput.svelte';
	import SteamTrafficComparison from '../lib/SteamTrafficComparison.svelte';
	import { daysAgo, nextComparisonPeriod, priorComparisonPeriod } from '../lib/dates.js';
	import {
		getQueryParam,
		getQueryParamDate,
		getQueryParamNumber,
		updateQueryParam
	} from '../lib/query.js';
	import { steamLikesBookmarklet } from '../lib/steamLikesBookmarklet.js';
	import {
		steamPlayersLink,
		steamTrafficLink,
		steamUtmLink,
		steamWishlistsLink
	} from '../lib/steamLinks.js';
	import { debounce, type PeriodDirection } from '../lib/util.js';

	let steamId = getQueryParamNumber('steamId', $page.url.searchParams) || 1401730;

	let toDate = getQueryParamDate('toDate', $page.url.searchParams) || new Date();
	let fromDate = getQueryParamDate('fromDate', $page.url.searchParams) || daysAgo(14, toDate);
	let periods = getQueryParamNumber('periods', $page.url.searchParams) || 1;
	let periodDirection: PeriodDirection =
		getQueryParam('periodDirection', $page.url.searchParams, (val) =>
			val && ['before', 'after'].includes(val) ? (val as PeriodDirection) : undefined
		) || 'before';
	let comparisonUrl: string;
	let nextPeriod: [Date, Date] | undefined;
	let nextFromDate: Date;
	let nextToDate: Date;

	function updateComparisonUrls(
		steamId: number,
		fromDate: Date,
		toDate: Date,
		periods: number,
		periodDirection: 'before' | 'after'
	) {
		let url = new URL($page.url.toString());
		updateQueryParam('steamId', steamId, url.searchParams);
		updateQueryParam('periods', periods, url.searchParams);
		updateQueryParam('periodDirection', periodDirection, url.searchParams);
		if (nextPeriod) {
			updateQueryParam('fromDate', nextPeriod[0], url.searchParams);
			updateQueryParam('toDate', nextPeriod[1], url.searchParams);
		}
		comparisonUrl = url.toString();
	}

	// A debounced function to goto the current URL
	let gotoCurrentUrl = debounce(() => browser && goto($page.url.toString()), 1000);

	async function setQueryParam(name: string, value: any) {
		updateQueryParam(name, value, $page.url.searchParams);
		// Update the URL
		gotoCurrentUrl();
	}

	$: {
		setQueryParam('steamId', steamId);
		setQueryParam('toDate', toDate);
		setQueryParam('fromDate', fromDate);
		setQueryParam('periods', periods);
		setQueryParam('periodDirection', periodDirection);
		updateComparisonUrls(steamId, fromDate, toDate, periods, periodDirection);
		nextPeriod =
			periodDirection === 'before'
				? priorComparisonPeriod(fromDate, toDate, periods)
				: nextComparisonPeriod(fromDate, toDate, periods);
		nextFromDate = nextPeriod?.[0] || fromDate;
		nextToDate = nextPeriod?.[1] || toDate;
	}
</script>

<svelte:head>
	<title>Game Stats Portal</title>
</svelte:head>

<h1>
	{steamId} | Game Stats Portal
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
	<input name="steamid" type="number" bind:value={steamId} />

	<label for="fromDate"> From </label>
	<DateInput name="fromDate" bind:date={fromDate} />

	<label for="toDate"> To </label>
	<DateInput name="toDate" bind:date={toDate} />

	<h3><a href={comparisonUrl} target="_blank"> Comparison Period </a></h3>
	<p>
		<input id="periods" type="number" bind:value={periods} min="1" />
		periods
		<select bind:value={periodDirection}>
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
			<a href={steamTrafficLink(steamId, fromDate, toDate)} target="_blank"> Steam Traffic </a>
			&nbsp; (<a href={steamTrafficLink(steamId, nextFromDate, nextToDate)} target="_blank"
				>comparison</a
			>)
		</li>
		<li>
			<a href={steamUtmLink(steamId, fromDate, toDate)} target="_blank"> Steam UTM </a> &nbsp; (<a
				href={steamUtmLink(steamId, nextFromDate, nextToDate)}
				target="_blank">comparison</a
			>)
		</li>
		<li>
			<a href={steamWishlistsLink(steamId, fromDate, toDate)} target="_blank"> Steam Wishlists </a>
			&nbsp; (<a href={steamWishlistsLink(steamId, nextFromDate, nextToDate)} target="_blank"
				>comparison</a
			>)
		</li>
		<li>
			<a href={steamPlayersLink(steamId, fromDate, toDate)} target="_blank"> Steam Players </a>
			&nbsp; (<a href={steamPlayersLink(steamId, nextFromDate, nextToDate)} target="_blank"
				>comparison</a
			>)
		</li>
	</ul>
</section>

<h2>Tools</h2>

{#if nextPeriod}
	<SteamTrafficComparison {steamId} {fromDate} {toDate} {nextPeriod} />
{/if}

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
		<a href={`https://partner.steamgames.com/apps/marketing/${steamId}`}>Steam Marketing Portal</a>
		<ul>
			<li>
				<a href={`https://partner.steamgames.com/apps/navtrafficstats/${steamId}`}>All Traffic</a>
			</li>
			<li>
				<a href={`https://partner.steamgames.com/apps/utmtrafficstats/${steamId}`}>All UTM</a>
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
		<a href={`https://steamlikes.co/app/${steamId}#statistics`}>Steam Likes</a>
	</li>
	<li>
		<a href={`https://steamdb.info/app/${steamId}/charts/`}>SteamDB</a>
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
