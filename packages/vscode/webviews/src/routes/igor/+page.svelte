<script lang="ts">
	import { parseArg } from '$lib/args.js';
	import AnglesDownIcon from '$lib/icons/AnglesDownIcon.svelte';
	import SearchIcon from '$lib/icons/SearchIcon.svelte';
	import { markSearchResults, type SearchProps } from '$lib/search.js';
	import Search from '$lib/Search.svelte';
	import { Vscode } from '$lib/Vscode.js';
	import type {
		IgorWebviewConfig,
		IgorWebviewExtensionPostRun,
		IgorWebviewExtensionPosts,
		IgorWebviewLog,
		IgorWebviewPosts
	} from '@local-vscode/shared';
	import MagicString from 'magic-string';
	import { tick } from 'svelte';

	const vscode = new Vscode<
		{
			running?: IgorWebviewExtensionPostRun;
			exitCode?: number | null;
			logs?: IgorWebviewLog[];
		},
		IgorWebviewPosts,
		IgorWebviewExtensionPosts
	>();

	interface Log extends IgorWebviewLog {
		asSearchResult?: string;
		asHtml?: string;
	}

	let running = $state<IgorWebviewExtensionPostRun | undefined>(undefined);
	let exitCode = $state(null as number | null);
	let logs = $state<Log[]>([]);
	let config = $state(undefined as IgorWebviewConfig | undefined);
	let mainStyle = $derived.by(() => {
		let style = '';
		if (config?.fontFamily) {
			style += `--font-family: ${config.fontFamily};`;
		}
		if (config?.fontSize) {
			style += `--font-size: ${config.fontSize}px;`;
		}
		if (config?.base) {
			style += config.base;
		}
		return style;
	});

	let footer = $state(undefined as HTMLElement | undefined);

	let showSearch = $state(false);
	let search: SearchProps = $state({});
	let searchResults = $state([] as HTMLElement[]);

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
			logs = [];
			exitCode = null;
			config = message.config;
			vscode.setState({ running, logs, exitCode });
		} else if (message.kind === 'config') {
			config = message.config;
			logs = logs.map((log) => styleLog(log));
			vscode.setState({ running, logs, exitCode });
		} else if (message.kind === 'log') {
			logs.push(...message.logs.map((log) => styleLog(log)));
			// Auto-scroll to the bottom
			debouncedScrollToBottom();
			vscode.setState({ running, logs, exitCode });
		} else if (message.kind === 'reset') {
			running = undefined;
			logs = [];
			vscode.postMessage({ kind: 'ready' });
		} else if (message.kind == 'exited') {
			exitCode = message.code;
		} else if (message.kind === 'toggle-search') {
			toggleSearch();
		}
	});

	const stylePatterns = new Map<string, RegExp | null>();
	function styleLog(log: Log): Log {
		log.asHtml = undefined; // reset
		const source = new MagicString(log.message);
		// Find the first matching line, if any
		for (const line of config?.lines || []) {
			let pattern = stylePatterns.get(line.pattern);
			if (pattern === null) continue;
			if (pattern === undefined) {
				try {
					let flags = 'd';
					if (!line.caseSensitive) {
						flags += 'i';
					}
					pattern = new RegExp(line.pattern, flags);
					stylePatterns.set(line.pattern, pattern);
				} catch (err) {
					console.error(`Failed create regex for pattern ${line.pattern}`, err);
					stylePatterns.set(line.pattern, null);
					continue;
				}
			}
			const match = log.message.match(pattern);
			if (match) {
				// If this has a base style, apply it!
				if (line.base) {
					source.prepend(`<span style="${line.base}">`);
					source.append('</span>');
				}

				// We're using the 'd' flag, so we have index positions of groups
				const groupPositions = match.indices?.groups;
				const groupValues = match.groups;
				const groupNames = Object.keys(groupPositions || {});

				// // If the _GMFILE_ group is present, we need to parse it
				// // as a file path so it can be linked.
				// let gmlFileUri: string | undefined;
				// if (groupValues?._GMFILE_) {
				// 	const lineNumber = +(groupValues?._GMLINE_ || '0');
				// 	gmlFileUri = gmlFileMacroToUri(run.projectDir, groupValues!._GMFILE_!, lineNumber);
				// }

				for (const groupName of groupNames) {
					const position = groupPositions?.[groupName] as [number, number] | undefined;
					if (!position) continue; // The key can exist without the indices, for conditional groups
					// if (gmlFileUri && ['_GMFILE_', line.gmlAnchor].includes(groupName)) {
					// 	// Then we want to link the file
					// 	source.prependRight(position[0], `<a href="${gmlFileUri}" title="Open in editor">`);
					// 	source.appendLeft(position[1], '</a>');
					// }
					if (line.styles?.[groupName]) {
						source.prependRight(position[0], `<span style="${line.styles[groupName]}">`);
						source.appendLeft(position[1], '</span>');
					}
				}
				log.asHtml = source.toString();
				break; // Only use the first match!
			}
		}
		return log;
	}

	async function loadSamples() {
		const samples = await import('./samples.js');
		running = samples.running;
		logs = samples.logs;
	}

	async function onSearchChange(props: SearchProps) {
		search = props;
		logs = logs.map((log) => {
			const marked = markSearchResults(log.message, search.query, {
				ignoreCase: !search.caseSensitive,
				asRegex: search.regex,
				asWholeWord: search.wholeWord
			});
			return {
				...log,
				asSearchResult: marked === log.message ? undefined : marked
			};
		});

		// Let the DOM update, then grab the list of nodes
		await tick();
		searchResults = [...document.querySelectorAll('mark.search-result').values()] as HTMLElement[];
	}
	function toggleSearch() {
		if (showSearch) {
			closeSearch();
		} else {
			openSearch();
		}
	}
	function openSearch() {
		showSearch = true;
		onSearchChange(search);
		// Also disable auto-scroll, since the user probably wants to scroll manually
		// while searching!
		autoScroll = false;
	}
	function closeSearch() {
		showSearch = false;
		searchResults = [];
		// Clear the asSearchResult html
		logs = logs.map((log) => {
			return {
				...log,
				asSearchResult: undefined
			};
		});
	}

	// Debounced scroll-to-bottom
	let timeout: NodeJS.Timeout | undefined;
	function debouncedScrollToBottom() {
		if (timeout || !autoScroll) {
			return;
		}
		timeout = setTimeout(() => {
			timeout = undefined;
			footer?.scrollIntoView();
		}, 100);
	}

	// Initial state

	if (vscode.developmentMode) {
		loadSamples();
	} else {
		const init = vscode.getState() || {};
		running = init.running;
		logs = init.logs || [];
		exitCode = init.exitCode ?? null;
	}
</script>

<main style={mainStyle}>
	{#if !running}
		<p><i>Nothing is running!</i></p>
	{:else}
		{#if showSearch}
			<aside class="search">
				<Search
					{...search}
					results={searchResults}
					on:change={(event) => onSearchChange(event.detail)}
					on:close={() => closeSearch()}
				/>
			</aside>
		{/if}
		<div>
			<ul class="reset">
				<li class="project-name">
					<b>Project:</b>
					{running.projectName}
				</li>
				<li>
					<b>Runtime:</b> v{running.runtimeVersion}
				</li>
				<li class="run-mode">
					<b>Mode:</b>
					{running.cleaning ? 'Clean' : 'Run'}
				</li>
			</ul>
			<details>
				<summary>Command</summary>
				<div class="command">
					<samp>{running.cmd}</samp>
					<ol class="reset args">
						{#each running.args as arg}
							{@const parsed = parseArg(arg)}
							{#if parsed.flag}
								<li class="arg-flag">
									<samp>{@html parsed.flag}</samp>
								</li>
							{/if}
							{#if parsed.value}
								<li class="arg-value">
									<samp>{parsed.value}</samp>
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
			<ul class="logs reset">
				{#each logs as log, i (i)}
					<li class={`log ${log.kind}`}>
						<!-- svelte-ignore a11y-missing-content -->
						<a href={`#log-${i}`}></a>
						<samp>
							{#if log.asSearchResult}
								{@html log.asSearchResult}
							{:else}
								{@html log.asHtml || log.message}
							{/if}
						</samp>
					</li>
				{/each}
			</ul>
			<aside class="sticky-footer-actions">
				{#if vscode.developmentMode}
					<button
						type="button"
						class={showSearch ? 'primary' : 'secondary'}
						title={showSearch ? 'Close search' : 'Open search'}
						on:click={() => toggleSearch()}
					>
						<SearchIcon />
					</button>
				{/if}
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
</main>

<style>
	main,
	samp,
	input,
	code {
		font-family: var(--font-family);
		font-size: var(--font-size);
	}
	aside.search {
		position: sticky;
		top: 0;
		padding-block: 0.25em;
		background-color: var(--color-background);
		border-bottom: 1px solid rgb(64, 64, 64);
	}
	details .command {
		margin-inline-start: 0.5em;
		border: 1px solid rgb(64, 64, 64);
		padding: 0.25em 0.4em;
	}
	.arg-flag {
		color: gray;
	}
	.arg-value {
		padding-left: 1em;
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
	li.log {
		border-left: 1px solid rgb(110, 110, 110);
		padding-left: 0.5em;
		margin-block: 0.1em;
	}
	li.log:hover {
		border-color: white;
	}
	aside.sticky-footer-actions {
		/* Should be absolutely positioned in the bottom-right corner */
		position: fixed;
		bottom: 0.25em;
		right: 0.25em;
		display: flex;
		gap: 0.25em;
	}
	aside.sticky-footer-actions button {
		padding: 0.25em 0.5em;
		height: 2.25em;
		width: 2.5em;
		display: flex;
		align-items: center;
		justify-content: center;
	}
	footer {
		/* Add a little extra space to allow room for absolute
		buttons etc */
		margin-block-start: 2em;
	}
</style>
