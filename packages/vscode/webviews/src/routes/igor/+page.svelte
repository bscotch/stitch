<script lang="ts">
	import { Vscode } from '$lib/Vscode.js';
	import type {
		IgorWebviewExtensionPostRun,
		IgorWebviewExtensionPosts,
		IgorWebviewLog,
		IgorWebviewPosts
	} from '@local-vscode/shared';

	const vscode = new Vscode<unknown, IgorWebviewPosts, IgorWebviewExtensionPosts>();

	let running = $state<IgorWebviewExtensionPostRun | undefined>(undefined);
	let logs = $state<IgorWebviewLog[]>([]);
	let footer = $state(undefined as HTMLElement | undefined);

	vscode.postMessage({ kind: 'ready' });
	vscode.onMessage((message) => {
		if (message.kind === 'run') {
			running = message;
			logs = [];
		} else if (message.kind === 'log') {
			logs.push(...message.logs);
			// Auto-scroll to the bottom
			debouncedScrollToBottom();
		} else if (message.kind === 'reset') {
			running = undefined;
			logs = [];
			vscode.postMessage({ kind: 'ready' });
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

	// Debounced scroll-to-bottom
	let timeout: NodeJS.Timeout | undefined;
	function debouncedScrollToBottom() {
		if (timeout) {
			return;
		}
		timeout = setTimeout(() => {
			timeout = undefined;
			footer?.scrollIntoView({ behavior: 'smooth' });
		}, 100);
	}
</script>

{#if !running}
	<p><i>Nothing is running!</i></p>
{:else}
	<h2>
		<span class="run-type">
			{running.cleaning ? 'Cleaning' : 'Running'}
		</span>
		<i class="project-name">
			{running.projectName}
		</i>
		with Runtime
		<span class="runtime-version">
			{running.runtimeVersion}
		</span>
	</h2>

	{#if logs.length === 0}
		<p><i>No logs yet...</i></p>
	{:else}
		<ul class="reset logs">
			{#each logs as log}
				<li class="log">
					<samp class={`log ${log.kind}`}>
						{log.message}
					</samp>
				</li>
			{/each}
		</ul>
	{/if}
{/if}

<footer bind:this={footer}></footer>

<style>
</style>