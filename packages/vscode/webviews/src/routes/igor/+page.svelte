<script lang="ts">
	import { Vscode } from '$lib/Vscode.js';
	import { parseArg } from '$lib/args.js';
	import AnglesDownIcon from '$lib/icons/AnglesDownIcon.svelte';
	import type {
		IgorWebviewExtensionPostRun,
		IgorWebviewExtensionPosts,
		IgorWebviewLog,
		IgorWebviewPosts
	} from '@local-vscode/shared';
	import Search from '../../lib/Search.svelte';
	import type { SearchProps } from '../../lib/search.js';

	const vscode = new Vscode<unknown, IgorWebviewPosts, IgorWebviewExtensionPosts>();

	let running = $state<IgorWebviewExtensionPostRun | undefined>(undefined);
	let exitCode = $state(null as number | null);
	let logs = $state<(IgorWebviewLog & { isMatch?: boolean })[]>([]);

	let footer = $state(undefined as HTMLElement | undefined);
	let logsList = $state(undefined as HTMLUListElement | undefined);

	let showSearch = $state(true);
	let search: SearchProps = $state({});
	let matchCount = $derived(logs.filter((log) => log.isMatch).length);
	let currentResultIndex = $state(0);
	$effect(() => {
		if (currentResultIndex >= matchCount) {
			currentResultIndex = 0;
		}
		if (currentResultIndex < 0) {
			currentResultIndex = matchCount - 1;
		}
		if (showSearch && search.query && matchCount > 0) {
			console.log([currentResultIndex, logsList?.children[currentResultIndex]]);
			logsList?.children[currentResultIndex]?.scrollIntoView();
		}
	});

	let autoScroll = $state(true);
	$effect(() => {
		if (autoScroll) {
			debouncedScrollToBottom();
		}
	});

	vscode.postMessage({ kind: 'ready' });
	vscode.onMessage((message) => {
		if (message.kind === 'run') {
			running = message;
			console.log(message);
			logs = [];
		} else if (message.kind === 'log') {
			logs.push(...message.logs);
			// Auto-scroll to the bottom
			debouncedScrollToBottom();
		} else if (message.kind === 'reset') {
			running = undefined;
			logs = [];
			vscode.postMessage({ kind: 'ready' });
		} else if (message.kind == 'exited') {
			exitCode = message.code;
		}
	});

	async function loadSamples() {
		const samples = await import('./samples.js');
		running = samples.running;
		logs = samples.logs;
	}
	if (vscode.developmentMode) {
		loadSamples();
	}

	function onSearchChange(props: SearchProps) {
		console.log('search change', props);
		search = props;
		currentResultIndex = 0;
		// Update all the logs to indicate if they match the search
		const matches = (log: IgorWebviewLog) => {
			if (!props.query) return false;
			if (props.regex) {
				const regex = new RegExp(props.query, props.caseSensitive ? 'g' : 'gi');
				return regex.test(log.message);
			} else if (!props.caseSensitive) {
				return log.message.toLowerCase().includes(props.query.toLowerCase());
			} else {
				return log.message.includes(props.query);
			}
		};
		logs = logs.map((log) => ({ ...log, isMatch: matches(log) }));
	}

	// Debounced scroll-to-bottom
	let timeout: NodeJS.Timeout | undefined;
	function debouncedScrollToBottom() {
		if (timeout || !autoScroll) {
			return;
		}
		7;
		timeout = setTimeout(() => {
			timeout = undefined;
			footer?.scrollIntoView({ behavior: 'smooth' });
		}, 100);
	}
</script>

{#if !running}
	<p><i>Nothing is running!</i></p>
{:else}
	<aside class="search">
		<Search
			total={matchCount}
			current={currentResultIndex}
			on:change={(event) => onSearchChange(event.detail)}
			on:close={() => (showSearch = false)}
			on:priorResult={() => {
				if (currentResultIndex > 0) {
					currentResultIndex--;
				} else if (currentResultIndex === 0) {
					currentResultIndex = matchCount - 1;
				}
			}}
			on:nextResult={() => {
				if (currentResultIndex < matchCount - 1) {
					currentResultIndex++;
				} else if (currentResultIndex === matchCount - 1) {
					currentResultIndex = 0;
				}
			}}
		/>
	</aside>
	<div>
		<ul class="reset">
			<li class="project-name">
				<code><b>Project:</b> {running.projectName}</code>
			</li>
			<li>
				<code><b>Runtime:</b> v{running.runtimeVersion}</code>
			</li>
			<li class="run-mode">
				<code><b>Mode:</b> {running.cleaning ? 'Clean' : 'Run'}</code>
			</li>
		</ul>
		<details>
			<summary>Command</summary>
			<div class="command">
				<code>{running.cmd}</code>
				<ol class="reset args">
					{#each running.args as arg}
						{@const parsed = parseArg(arg)}
						{#if parsed.flag}
							<li class="arg-flag">
								<code>{@html parsed.flag}</code>
							</li>
						{/if}
						{#if parsed.value}
							<li class="arg-value">
								<code>{parsed.value}</code>
							</li>
						{/if}
					{/each}
				</ol>
			</div>
		</details>
	</div>

	{#if logs.length === 0}
		<p><i>No logs yet...</i></p>
	{:else}
		<ul class="logs" bind:this={logsList}>
			{#each logs as log, i (i)}
				<li
					class={`log ${log.kind}${search.query && log.isMatch ? ' search-result' : ''}${currentResultIndex === i ? ' current-result' : ''}`}
				>
					<!-- svelte-ignore a11y-missing-content -->
					<a href={`#log-${i}`}></a>
					<samp>
						{log.message}
					</samp>
				</li>
			{/each}
		</ul>
		<aside class="sticky-footer-actions">
			<button
				type="button"
				class={autoScroll ? 'primary' : 'secondary'}
				title={autoScroll ? 'Disable auto-scroll' : 'Enable auto-scroll'}
				on:click={() => (autoScroll = !autoScroll)}
			>
				<AnglesDownIcon />
			</button>
		</aside>
		<footer bind:this={footer}>
			{#if exitCode !== null}
				<p>
					<em>Process exited with code {exitCode}</em>
				</p>
			{/if}
		</footer>
	{/if}
{/if}

<style>
	aside.search {
		position: fixed;
		top: 0.25em;
		right: 0.25em;
	}
	ol.args {
		display: flex;
		flex-wrap: wrap;
		flex-direction: row;
		gap: 0.25em;
	}
	ol.args li {
		display: inline;
	}
	details .command {
		margin-inline-start: 0.5em;
	}
	ul.logs {
		padding-inline-start: 0.5em;
	}
	li.log {
		list-style-type: '›';
		padding-inline-start: 0.25em;
	}
	li.log::marker {
		color: gray;
		font-size: 0.5em;
	}
	li.log.search-result {
		list-style-type: '▶';
	}
	li.log.search-result::marker {
		color: yellow;
	}
	li.log.search-result.current-result::marker {
		color: rgb(0, 220, 0);
	}
	.arg-flag {
		color: gray;
	}
	.log.stderr {
		color: var(--color-text-error);
	}
	section,
	li,
	code {
		/* word-break: break-all; */
		overflow-wrap: break-word;
	}
	aside.sticky-footer-actions {
		/* Should be absolutely positioned in the bottom-right corner */
		position: fixed;
		bottom: 0.25em;
		right: 0.25em;
	}
	footer {
		/* Add a little extra space to allow room for absolute
		buttons etc */
		margin-block-start: 2em;
	}
</style>
