<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { dateToDateInputString } from '../lib/dates.js';

	export let name: string;
	export let date: Date | undefined;

	const dispatch = createEventDispatcher<{ change: Date | undefined }>();

	// Convert a YYYY-MM-DD string to a Date object in the local timezone
	function inputDateToDate(dateString: string | undefined) {
		if (!dateString) return undefined;
		const offset = new Date().getTimezoneOffset();
		const offsetHours = `${Math.round(Math.abs(offset / 60))}`.padStart(2, '0');
		const offsetMinutes = `${Math.abs(offset % 60)}`.padStart(2, '0');
		const asIsoString = `${dateString}T08:00:00${
			offset > 0 ? '-' : '+'
		}${offsetHours}:${offsetMinutes}`;
		return new Date(asIsoString);
	}
</script>

<input
	{name}
	type="date"
	value={dateToDateInputString(date)}
	on:change={(e) => {
		dispatch('change', inputDateToDate(e.currentTarget.value));
	}}
/>
