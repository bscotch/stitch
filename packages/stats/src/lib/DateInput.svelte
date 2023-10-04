<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { dateToDateInputString } from './dates.js';

	export let name: string;
	export let date: Date | undefined;

	const dispatch = createEventDispatcher<{ change: Date | undefined }>();

	let internalDate: string | undefined = dateToDateInputString(date);

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

	$: date = internalDate ? inputDateToDate(internalDate) : undefined;
</script>

<input
	{name}
	type="date"
	bind:value={internalDate}
	on:change={(e) => dispatch('change', inputDateToDate(e.currentTarget.value))}
/>
