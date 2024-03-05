<script lang="ts">
	import CaseSensitiveIcon from '$lib/icons/CaseSensitiveIcon.svelte';
	import RegexIcon from '$lib/icons/RegexIcon.svelte';
	import WholeWordIcon from '$lib/icons/WholeWordIcon.svelte';
	import { createEventDispatcher } from 'svelte';
	import SearchIcon from './icons/SearchIcon.svelte';
	import type { SearchProps } from './search.js';

	const dispatch = createEventDispatcher<{
		change: SearchProps;
		close: undefined;
	}>();

	let { caseSensitive, regex, wholeWord, query, results } = $props<
		SearchProps & { results?: HTMLElement[] }
	>();

	let currentResultIdx = $state(0);
	let total = $derived(results?.length || 0);
	let current = $derived(results?.length ? results[currentResultIdx] : undefined);
	let queryHistory = $state<string[]>([]);

	$effect(() => {
		currentResultIdx; // to trigger reactivity
		results?.[currentResultIdx]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
	});

	function goToPrior() {
		if (!results?.length) return;
		if (currentResultIdx > 0) {
			currentResultIdx--;
		} else {
			currentResultIdx = results.length - 1;
		}
	}
	function goToNext() {
		if (!results?.length) return;
		if (currentResultIdx < results.length - 1) {
			currentResultIdx++;
		} else {
			currentResultIdx = 0;
		}
	}

	let updateTimeout: NodeJS.Timeout | undefined;
	function update() {
		if (updateTimeout) {
			clearTimeout(updateTimeout);
		}
		updateTimeout = setTimeout(() => {
			dispatch('change', { caseSensitive, regex, query, wholeWord });
			updateTimeout = undefined;
			currentResultIdx = 0;
			if (query && queryHistory.at(-1) !== query) {
				queryHistory.push(query);
			}
		}, 200);
	}
</script>

<search>
	<span class="search-field">
		<SearchIcon --icon-width="0.6em" />
		<input
			autofocus
			bind:value={query}
			on:keyup={(event) => {
				if (event.key === 'Escape') {
					dispatch('close');
				} else if (event.key === 'ArrowUp') {
					goToPrior();
				} else if (event.key === 'ArrowDown') {
					goToNext();
				} else update();
			}}
			type="text"
			placeholder="Search logs"
		/>
	</span>
	<span class="search-options">
		<button
			title="Toggle Case Sensitive search"
			class={'option ' + (caseSensitive ? 'active' : 'inactive')}
			on:click={() => {
				caseSensitive = !caseSensitive;
				update();
			}}
		>
			<CaseSensitiveIcon />
		</button>
		<button
			title="Toggle Whole Word search"
			class={'option ' + (wholeWord ? 'active' : 'inactive')}
			on:click={() => {
				wholeWord = !wholeWord;
				if (wholeWord) regex = false; // wholeWord and regex are mutually exclusive
				update();
			}}
		>
			<WholeWordIcon />
		</button>
		<button
			title="Toggle Regular Expression search"
			class={'option ' + (regex ? 'active' : 'inactive')}
			on:click={() => {
				regex = !regex;
				if (regex) wholeWord = false; // wholeWord and regex are mutually exclusive
				update();
			}}
		>
			<RegexIcon />
		</button>
	</span>
	<span class="search-nav">
		{#if total && query}
			<span class="tally">{currentResultIdx + 1}/{total}</span>
		{:else}
			<span class={`tally ${query ? 'no-results' : ''}`}>0/0</span>
		{/if}
		<button class="option" title="Prior Result" on:click={() => goToPrior()}> ▲ </button>
		<button class="option" title="Next Result" on:click={() => goToNext()}> ▼ </button>
	</span>
</search>

<style>
	search {
		display: grid;
		grid-template-columns: 1fr auto auto;
		align-items: center;
		gap: 0.25em;
		background-color: var(--color-background);
		width: 100%;
		font-size: 1em;
	}
	.search-field {
		display: flex;
		align-items: center;
		gap: 0.25em;
	}
	input {
		background-color: transparent;
		border: none;
		color: inherit;
		padding-inline-start: 0.25em;
		width: 100%;
	}
	input:focus-visible {
		outline: none;
	}
	.search-options,
	.search-nav {
		display: flex;
		align-items: center;
	}
	.search-options {
		padding-inline-end: 0.2em;
		border-right: 1px solid rgb(84, 84, 84);
		gap: 0.1em;
	}
	.search-nav button.option {
		padding-inline: 0.2em;
	}
	button.option {
		background-color: transparent;
		border: none;
		color: inherit;
		padding: 0.25em 0.4em;
		display: flex;
		align-items: center;
		justify-content: center;
	}
	button.option:hover {
		background-color: rgba(90, 93, 94, 0.5);
	}
	button.option.active {
		color: #ffffff;
		border-color: #2488db;
		background-color: rgba(36, 137, 219, 0.51);
	}
	.tally {
		font-size: 0.75em;
		padding-inline-end: 0.4em;
		border-right: 1px solid rgb(84, 84, 84);
		margin-inline-end: 0.2em;
	}
	.tally.no-results {
		color: var(--color-text-error);
	}
</style>
