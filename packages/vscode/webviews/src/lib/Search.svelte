<script lang="ts">
	import CaseSensitiveIcon from '$lib/icons/CaseSensitiveIcon.svelte';
	import RegexIcon from '$lib/icons/RegexIcon.svelte';
	import { createEventDispatcher } from 'svelte';
	import type { SearchProps } from './search.js';

	const dispatch = createEventDispatcher<{
		change: SearchProps;
		close: undefined;
		priorResult: undefined;
		nextResult: undefined;
	}>();

	let { caseSensitive, regex, query, total, current } = $props<
		SearchProps & { total?: number; current?: number }
	>();

	let updateTimeout: NodeJS.Timeout | undefined;
	function update() {
		if (updateTimeout) {
			clearTimeout(updateTimeout);
		}
		updateTimeout = setTimeout(() => {
			dispatch('change', { caseSensitive, regex, query });
		}, 200);
	}
</script>

<search>
	<input bind:value={query} on:keyup={() => update()} type="text" placeholder="Search logs" />
	<button
		class={'option ' + (caseSensitive ? 'active' : 'inactive')}
		on:click={() => {
			caseSensitive = !caseSensitive;
			update();
		}}
	>
		<CaseSensitiveIcon />
	</button>
	<button
		class={'option ' + (regex ? 'active' : 'inactive')}
		on:click={() => {
			regex = !regex;
			update();
		}}
	>
		<RegexIcon />
	</button>
	{#if total && typeof current === 'number'}
		<span class="tally">{current + 1} / {total}</span>
	{/if}
	<button class="secondary" title="Prior Result" on:click={() => dispatch('priorResult')}>
		▲
	</button>
	<button class="secondary" title="Next Result" on:click={() => dispatch('nextResult')}> ▼ </button>
	<button class="secondary" title="Close" on:click={() => dispatch('close')}> × </button>
</search>

<style>
	search {
		background-color: var(--vscode-input-background, #313131);
		border: 1px solid var(--vscode-widget-border, #cccccc);
		border-radius: 0.25em;
		color: var(--vscode-input-foreground, #cccccc);
		display: flex;
		gap: 0.25em;
		align-items: center;
		padding: 0.25em 0.25em;
	}
	input {
		background-color: transparent;
		border: none;
		color: inherit;
		padding-inline-start: 0.25em;
	}
	input:focus-visible {
		outline: none;
	}
	button.option {
		background-color: transparent;
		border: none;
		color: inherit;
		padding: 0.25em 0.5em;
		display: flex;
		align-items: center;
		justify-content: center;
	}
	button.option:hover {
		background-color: var(--vscode-inputOption-hoverBackground, rgba(90, 93, 94, 0.5));
	}
	button.option.active {
		color: var(--vscode-inputOption-activeForeground, #ffffff);
		border-color: var(--vscode-inputOption-activeBorder, #2488db);
		background-color: var(--vscode-inputOption-activeBackground, rgba(36, 137, 219, 0.51));
	}
	button.secondary {
		padding: 0.25em 0.5em;
	}
	.tally {
		font-size: 0.75em;
	}
</style>
