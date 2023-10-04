<script lang="ts">
	import { steamTrafficDownloadLink } from './steamLinks.js';

	export let steamId: number;
	export let fromDate: Date;
	export let toDate: Date;
	export let nextPeriod: [Date, Date];

	let comparisonSteamTrafficDownloadUrl: string;
	let currentFile: FileList | undefined;
	let comparisonFile: FileList | undefined;
	const files: [File | undefined, File | undefined] = [undefined, undefined];

	function processFile(files: FileList | undefined, idx: number) {
		if (!files || !files.length) return;
		let file = files[0];
		let reader = new FileReader();
		// Get the date range from the filename if possible
	}

	$: {
		comparisonSteamTrafficDownloadUrl = steamTrafficDownloadLink(
			steamId,
			nextPeriod[0],
			nextPeriod[1]
		);
		processFile(currentFile, 0);
		processFile(comparisonFile, 1);
	}
</script>

<section>
	<h3>Steam Traffic Comparison</h3>

	<p>
		The <a href={`https://partner.steamgames.com/apps/navtrafficstats/${steamId}`}>Steam Traffic</a>
		page provides download buttons to get the data as CSV, but doesn't provide a way to compare two periods.
		You can upload CSVs for two different periods here to compare them.
	</p>

	<p>
		<i>
			(We can't download them for you, so you'll have to download them first (you can use the links
			below) and then upload them. They aren't actually uploaded -- they're processed right in your
			browser!)
		</i>
	</p>

	<p id="steam-traffic-downloads">
		🌐 Downloads: <a href={steamTrafficDownloadLink(steamId, fromDate, toDate)}>Current</a> |
		<a href={comparisonSteamTrafficDownloadUrl}>Comparison Period</a>
	</p>
	<form id="steam-traffic-uploads">
		⬆️ Uploads:
		<div>
			<label for="current-traffic"> Current </label>
			<input bind:files={currentFile} name="current-traffic" type="file" accept=".csv" />
			<label for="comparison-traffic"> Comparison Period </label>
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
