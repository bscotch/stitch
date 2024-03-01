<script lang="ts">
	import { Vscode } from '$lib/Vscode.js';

	const vscode = new Vscode();
	let counter = $state(0);
</script>

<h1>Igor Output</h1>
<p>{counter}</p>
<button on:click={() => counter++}>Increment</button>
