<script lang="ts">
	// Keep a query parameter "steamid" in sync with the steamId variable
	import { config } from '../lib/stores.js';
	import DateInput from './DateInput.svelte';

	config.init();
</script>

<h2>Configuration</h2>

<form id="config">
	<label for="steamid"> Steam App ID </label>
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
