<script lang="ts">
	import { config, links } from '$lib/stores.js';
	import { assert } from './errors.js';

	let currentFile: FileList | undefined;
	let comparisonFile: FileList | undefined;
	let error = '';

	type KeyField = (typeof keyFields)[number];
	const keyFields = ['Page / Category', 'Page / Feature'] as const;

	type Entry = {
		[Key in KeyField]: string;
	} & { [key: string]: string | number };

	const parsed: [Entry[] | undefined, Entry[] | undefined] = [undefined, undefined];

	let fileUrls: [byStoreFeature: string | undefined, byCountry: string | undefined] = [
		undefined,
		undefined
	];
	let totals: { [key: string]: number } | undefined;

	function compareFiles() {
		const current = parsed[0];
		const compareTo = parsed[1];
		if (!current || !compareTo) return;

		// Identify all unique key-combos from both files,
		// as well as the non-key field names
		const keys = new Set<string>();
		const otherFields = new Set<string>();
		const addedFields = new Set<string>();

		const sep = '|$|$|';
		const getKey = (entry: Entry) => `${entry[keyFields[0]]}${sep}${entry[keyFields[1]]}`;
		current.forEach((entry) => {
			keys.add(getKey(entry));
			Object.keys(entry).forEach((key) => keyFields.includes(key as any) || otherFields.add(key));
		});

		const currentMap = new Map<string, Entry>();
		current.forEach((entry) => currentMap.set(getKey(entry), entry));
		const comparisonMap = new Map<string, Entry>();
		compareTo.forEach((entry) => comparisonMap.set(getKey(entry), entry));

		const combined: Entry[] = [];
		const combinedCountries: Entry[] = [];

		for (const key of keys) {
			const keyFieldValues = key.split(sep) as [string, string];
			const combinedEntry: Entry = {
				[keyFields[0]]: keyFieldValues[0],
				[keyFields[1]]: keyFieldValues[1]
			};
			const currentEntry = currentMap.get(key) || ({} as Entry);
			const comparisonEntry = comparisonMap.get(key) || ({} as Entry);

			for (const field of otherFields) {
				const currentValue = +currentEntry[field] || 0;
				const comparisonValue = +comparisonEntry[field] || 0;
				const compField = `${field} (Comparison)`;
				const diffField = `${field} (Difference)`;
				const foldChangeField = `${field} (Fold Change)`;
				addedFields.add(compField);
				addedFields.add(diffField);
				addedFields.add(foldChangeField);

				combinedEntry[field] = currentValue;
				combinedEntry[compField] = comparisonValue;
				combinedEntry[diffField] = currentValue - comparisonValue;
				combinedEntry[foldChangeField] = currentValue / comparisonValue;
			}

			// The country entries have their first key value as "Country"
			if (combinedEntry[keyFields[0]] === 'Country') {
				combinedCountries.push(combinedEntry);
			} else {
				combined.push(combinedEntry);
			}
		}

		// Convert the data into downloadable CSVs
		fileUrls = [undefined, undefined];
		const dataFields = [...otherFields, ...addedFields].sort();
		const allFields = [...keyFields, ...dataFields];

		totals = {};
		for (const [idx, entries] of [
			[0, combined],
			[1, combinedCountries]
		] as const) {
			const csv = [allFields.join(',')];
			entries.forEach((entry) => {
				const asString = allFields.map((field) => `${entry[field]}`.replace(/,/g, ';')).join(',');
				if (idx === 0) {
					for (const field of otherFields) {
						totals![field] = (totals![field] || 0) + (+entry[field] || 0);
						const comparisonField = `${field} (Comparison)` as const;
						totals![comparisonField] =
							(totals![comparisonField] || 0) + (+entry[comparisonField] || 0);
					}
				}
				csv.push(asString);
			});
			const blob = new Blob([csv.join('\n')], { type: 'text/csv' });
			fileUrls[idx] = URL.createObjectURL(blob);
		}

		// Add the diff fields to the totals
		for (const field of otherFields) {
			const diffField = `${field} (Difference)`;
			const foldChangeField = `${field} (Fold Change)`;
			totals![diffField] = totals![field] - totals![`${field} (Comparison)`];
			totals![foldChangeField] = totals![field] / totals![`${field} (Comparison)`];
		}
	}

	function processFile(files: FileList | undefined, idx: number) {
		if (!files || !files.length) return;
		let file = files[0];
		let reader = new FileReader();
		// Read the CSV file and convert it to JSON
		reader.onload = function (e) {
			try {
				if (!e.target) return;
				let csv = e.target.result as string;
				let lines = csv
					.trim()
					.split(/[\r\n]+/g)
					.map((line) =>
						line
							.trim()
							.split(',')
							.map((cell) => cell.trim().replace(/^"(.*)"$/, '$1'))
					);
				const headers = lines.shift()!;
				assert(
					headers[0] === 'Page / Category',
					"Invalid CSV file. First column should be 'Page / Category'."
				);
				assert(
					headers[1] === 'Page / Feature',
					"Invalid CSV file. Second column should be 'Page / Feature'."
				);

				const entries: Entry[] = [];
				lines.forEach((line) => {
					if (line.length !== headers.length) return;
					const entry: Entry = {
						'Page / Category': line[0],
						'Page / Feature': line[1]
					};
					for (let i = 2; i < headers.length; i++) {
						if (headers[i].startsWith('Owner')) {
							continue; // This isn't useful data for us so it adds NOISE
						}
						entry[headers[i]] = +line[i];
					}
					entries.push(entry);
				});
				parsed[idx] = entries;

				compareFiles();
			} catch (err) {
				console.error(err);
				error = err instanceof Error ? err.message : 'Something went wrong!';
			}
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
		⬇️ Download Traffic Data: <a href={$links.steamTrafficDownloadLink}>Current</a> |
		<a href={$links.comparisonSteamTrafficDownloadLink}>Comparison Period</a>
	</p>
	<form id="steam-traffic-uploads">
		⬆️ Compare Traffic Data:
		<div>
			<label for="current-traffic"> Current </label>
			<input bind:files={currentFile} name="current-traffic" type="file" accept=".csv" />
			<label for="comparison-traffic"> Comparison Period </label>
			<input bind:files={comparisonFile} name="comparison-traffic" type="file" accept=".csv" />
		</div>
	</form>

	{#if error}
		<p style="color: red;">{error}</p>
	{/if}

	{#if fileUrls[0] && fileUrls[1]}
		<p>
			<b style="color:var(--color-result)">Full Results:</b>
			<a href={fileUrls[0]} download="steam-combined-traffic-store.csv">By Store Feature</a>
			| <a href={fileUrls[1]} download="steam-combined-traffic-country.csv">By Country</a>
		</p>
	{/if}

	{#if totals}
		<p><b style="color:var(--color-result)">Summary:</b></p>
		<dl>
			{#each Object.entries(totals) as [key, value]}
				{#if !isNaN(value)}
					<dt>{key}</dt>
					<dd>{value - Math.round(value) === 0 ? value : value.toFixed(2)}</dd>
				{/if}
			{/each}
		</dl>
	{/if}
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
	dl {
		margin-left: 1em;
		display: grid;
		grid-template-columns: max-content max-content;
	}
	dt {
		font-weight: bold;
		padding-right: 0.5em;
		text-align: right;
	}
</style>
