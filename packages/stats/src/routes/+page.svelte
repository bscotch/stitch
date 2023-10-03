<script lang="ts">
	import { browser } from '$app/environment';
	import { goto } from '$app/navigation';
	// Keep a query parameter "steamid" in sync with the steamId variable
	import { page } from '$app/stores';
	import DateInput from '../lib/DateInput.svelte';
	import { daysAgo } from '../lib/dates.js';
	import {
		steamPlayersLink,
		steamTrafficLink,
		steamUtmLink,
		steamWishlistsLink
	} from '../lib/steamLinks.js';

	let steamId = getQuerySteamId() || 1401730;

	let toDate = getQueryToDate() || new Date();
	let fromDate = getQueryFromDate() || daysAgo(14, toDate);

	function updateSteamId() {
		if (!steamId || getQuerySteamId() === steamId) return;

		$page.url.searchParams.set('steamid', `${steamId}`);

		browser && goto($page.url.toString());
	}

	function updateToDate(date: Date) {
		$page.url.searchParams.set('toDate', date.toISOString());
		browser && goto($page.url.toString());
	}

	function updateFromDate(date: Date) {
		$page.url.searchParams.set('fromDate', date.toISOString());
		browser && goto($page.url.toString());
	}

	function getQuerySteamId() {
		return Number($page.url.searchParams.get('steamid'));
	}

	function getQueryToDate() {
		return $page.url.searchParams.get('toDate')
			? new Date($page.url.searchParams.get('toDate')!)
			: undefined;
	}

	function getQueryFromDate() {
		return $page.url.searchParams.get('fromDate')
			? new Date($page.url.searchParams.get('fromDate')!)
			: undefined;
	}

	updateSteamId();

	$: {
		updateToDate(toDate);
		updateFromDate(fromDate);
	}
</script>

<svelte:head>
	<title>Game Stats Portal</title>
</svelte:head>

<h1>
	{steamId} | Game Stats Portal
</h1>

<p>
	Get links to useful stats pages for a given Steam game and date range. Request additional URLs or
	submit bug reports via <a href="https://github.com/bscotch/stitch/issues">GitHub Issues</a>.
</p>

<form id="config">
	<label for="steamid"> Steam ID </label>
	<input
		name="steamid"
		type="number"
		bind:value={steamId}
		on:change={updateSteamId}
		on:keyup={(e) => e.key === 'Enter' && updateSteamId()}
	/>

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
		Created by <a href="https://www.bscotch.net/">Butterscotch Shenanigans</a>
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
</style>
