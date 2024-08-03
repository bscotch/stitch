<script lang="ts">
	// Keep a query parameter "steamid" in sync with the steamId variable
	import { config } from '../lib/stores.js';
	import DateInput from './DateInput.svelte';
	import SteamLanguageSelect from './SteamLanguageSelect.svelte';

	config.init();
</script>

<h2>Configuration</h2>

<form id="config">
	<label for="steamid"> Steam App ID </label>
	<input
		name="steamid"
		type="number"
		value={$config.steamId}
		on:keyup={(e) => config.setField('steamId', +e.currentTarget.value)}
	/>

	<label for="fromDate"> From </label>
	<DateInput
		name="fromDate"
		date={$config.fromDate}
		on:keyup={(e) => config.setField('fromDate', e.detail)}
	/>

	<label for="toDate"> To </label>
	<DateInput
		name="toDate"
		date={$config.toDate}
		on:keyup={(e) => config.setField('toDate', e.detail)}
	/>

	<h3>Comparison Period</h3>
	<p>
		<input
			id="periods"
			type="number"
			min="1"
			value={$config.periods}
			on:keyup={(e) => config.setField('periods', +e.currentTarget.value)}
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

	<h3>Store Page Link</h3>
	<p>
		<a
			href={`https://store.steampowered.com/app/${$config.steamId}${$config.language ? `?l=${$config.language}` : ''}`}
			target="_blank"
		>
			https://store.steampowered.com/app/{$config.steamId}{$config.language
				? `?l=${$config.language}`
				: ''}
		</a>
		<SteamLanguageSelect
			initial={$config.language}
			onselect={(lang) => config.setField('language', lang?.code)}
		/>
	</p>
</form>

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
	#periods {
		max-width: 3rem;
		margin: 0 0.25rem;
		padding: 0;
	}
	h3 {
		text-align: right;
	}
	/* Below 600px width we need to stack labels over inputs */
	@media (max-width: 600px) {
		#config {
			grid-template-columns: 1fr;
		}
		#config label {
			text-align: left;
		}
	}
</style>
