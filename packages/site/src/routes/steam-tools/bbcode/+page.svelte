<script lang="ts">
	import { md2bbcode } from '@bscotch/steam-bbcode';

	let source = '';
	let bbcode = '';

	$: bbcode = convertSource(source);

	function convertSource(src: string): string {
		const asBbCode = md2bbcode(src);
		console.log(asBbCode);
		return asBbCode.bbcode.trim();
	}
</script>

<section>
	<h1>Markdown to Steam BBCode Converter</h1>
	<p>
		Steam has been around for a while, and many part of its content management system still use
		legacy BBCode formats. This tool generates BBCode from Markdown.
	</p>

	<h2>Source</h2>
	<p>Paste your Markdown or HTML source content below.</p>

	<textarea id="source" bind:value={source}></textarea>

	<br />
	<h2>BBCode Output</h2>
	{#if !bbcode}
		<p><i>Nothing to show yet!</i></p>
	{:else}
		<button
			on:click={() => {
				navigator.clipboard.writeText(bbcode);
			}}>📋 Copy BBCode</button
		>
	{/if}
	<output for="source">{bbcode ?? ''}</output>
</section>

<style>
	textarea {
		width: 100%;
		min-height: 5lh;
		field-sizing: content;
	}

	output {
		display: block;
		white-space: pre-wrap;
		font-family: monospace;
		border: 1px solid gray;
		padding: 1rem 1.5rem;
	}
</style>
