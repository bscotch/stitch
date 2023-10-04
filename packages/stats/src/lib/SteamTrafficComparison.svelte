<script lang="ts">
	import { config, links } from '$lib/stores.js';

	let currentFile: FileList | undefined;
	let comparisonFile: FileList | undefined;
	const files: [File | undefined, File | undefined] = [undefined, undefined];

	function processFile(files: FileList | undefined, idx: number) {
		if (!files || !files.length) return;
		let file = files[0];
		let reader = new FileReader();
		// Read the CSV file and convert it to JSON
		reader.onload = function (e) {
			console.log(e);
			if (!e.target) return;
			let csv = e.target.result as string;
			let lines = csv.split('\n');
			let headers = lines[0].split(',');

			// let data = [];
			// for (let i = 1; i < lines.length; i++) {
			// 	let obj = {};
			// 	let currentline = lines[i].split(',');
			// 	for (let j = 0; j < headers.length; j++) {
			// 		obj[headers[j]] = currentline[j];
			// 	}
			// 	data.push(obj);
			// }
		};
		reader.readAsText(file);
	}

	$: {
		processFile(currentFile, 0);
		processFile(comparisonFile, 1);
	}
</script>

<section>
	<h3>Steam Traffic Comparison</h3>

	<p>
		The <a href={`https://partner.steamgames.com/apps/navtrafficstats/${$config.steamId}`}
			>Steam Traffic</a
		>
		page provides download buttons to get the data as CSV, but doesn't provide a way to compare two periods.
		You can upload CSVs for two different periods here to compare them.
	</p>

	<p id="steam-traffic-downloads">
		⬇️ Download Source Files: <a href={$links.steamTrafficDownloadLink}>Current</a> |
		<a href={$links.comparisonSteamTrafficDownloadLink}>Comparison Period</a>
	</p>
	<form id="steam-traffic-uploads">
		⬆️ Load Source Files:
		<div>
			<label for="current-traffic"> Data </label>
			<input bind:files={currentFile} name="current-traffic" type="file" accept=".csv" />
			<label for="comparison-traffic"> Relative To </label>
			<input bind:files={comparisonFile} name="comparison-traffic" type="file" accept=".csv" />
		</div>
	</form>
</section>

<style>
	#steam-traffic-uploads div {
		display: grid;
		grid-template-columns: max-content max-content;
		gap: 0.5em;
		padding-left: 2em;
	}
	#steam-traffic-uploads {
		margin-top: 0;
	}
	label {
		text-align: right;
	}
</style>
