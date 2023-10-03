<script lang="ts">
	import { browser } from '$app/environment';
	import { goto } from '$app/navigation';
	// Keep a query parameter "steamid" in sync with the steamId variable
	import { page } from '$app/stores';
	import DateInput from '../lib/DateInput.svelte';
	import { daysAgo, nextComparisonPeriod, priorComparisonPeriod } from '../lib/dates.js';
	import {
		getQueryParam,
		getQueryParamDate,
		getQueryParamNumber,
		updateQueryParam
	} from '../lib/query.js';
	import {
		steamPlayersLink,
		steamTrafficLink,
		steamUtmLink,
		steamWishlistsLink
	} from '../lib/steamLinks.js';
	import { debounce } from '../lib/util.js';

	type PeriodDirection = 'before' | 'after';

	let steamId = getQueryParamNumber('steamId', $page.url.searchParams) || 1401730;

	let toDate = getQueryParamDate('toDate', $page.url.searchParams) || new Date();
	let fromDate = getQueryParamDate('fromDate', $page.url.searchParams) || daysAgo(14, toDate);
	let periods = getQueryParamNumber('periods', $page.url.searchParams) || 1;
	let periodDirection: PeriodDirection =
		getQueryParam('periodDirection', $page.url.searchParams, (val) =>
			val && ['before', 'after'].includes(val) ? (val as PeriodDirection) : undefined
		) || 'before';
	let comparisonUrl: string;

	function updateComparisonUrl(
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
		const nextPeriod =
			periodDirection === 'before'
				? priorComparisonPeriod(fromDate, toDate, periods)
				: nextComparisonPeriod(fromDate, toDate, periods);
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
		updateComparisonUrl(steamId, fromDate, toDate, periods, periodDirection);
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

<form id="config">
	<label for="steamid"> Steam ID </label>
	<input name="steamid" type="number" bind:value={steamId} />

	<label for="fromDate"> From </label>
	<DateInput name="fromDate" bind:date={fromDate} />

	<label for="toDate"> To </label>
	<DateInput name="toDate" bind:date={toDate} />
</form>

<h2>Ranged Data</h2>

<p>The following links are populated using the given Steam ID and date range.</p>

<ul>
	<li>
		<a href={steamTrafficLink(steamId, fromDate, toDate)}>Steam Traffic</a>
	</li>
	<li>
		<a href={steamUtmLink(steamId, fromDate, toDate)}>Steam UTM</a>
	</li>
	<li>
		<a href={steamWishlistsLink(steamId, fromDate, toDate)}>Steam Wishlists</a>
	</li>
	<li>
		<a href={steamPlayersLink(steamId, fromDate, toDate)}>Steam Players</a>
	</li>
</ul>

<a href={comparisonUrl} target="_blank">Open comparison</a> period<input
	id="periods"
	type="number"
	bind:value={periods}
	min="1"
/>
periods
<select bind:value={periodDirection}>
	<option>before</option>
	<option>after</option>
</select>
the given date range.

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
	<p>
		💖 Created by <a href="https://www.bscotch.net/">Butterscotch Shenanigans</a>
	</p>
	<p>
		💡 Request additional URLs or submit bug reports via <a
			href="https://github.com/bscotch/stitch/issues">GitHub Issues</a
		>.
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
	footer {
		text-align: center;
	}
	#periods {
		max-width: 3rem;
		margin: 0 0.25rem;
		padding: 0;
	}
</style>
