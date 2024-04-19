<script lang="ts">
	import { tick } from 'svelte';

	const timePattern =
		/^(?:(?:(?<hours>\d+):)?(?<minutes>\d+):)?(?<seconds>\d+)(?:\.(?<millis>\d+))?$/;

	let tsv = '';
	let sbvs: { name: string; sbv: string }[] = [];
	let errors: string[] = [];

	$: {
		sbvs = [];
		tsv = cleanTsv(tsv);
		tick().then(() => (sbvs = parseTsv(tsv)));
	}

	function cleanTsv(rawTsv: string) {
		rawTsv = rawTsv.trim();
		const lines = rawTsv
			.split(/[\r\n]+/)
			.map((line) => (line.match(/^\s+%/) ? '' : line.trimEnd()))
			.filter(Boolean);
		rawTsv = lines.join('\n');
		return rawTsv;
	}

	function parseTsv(cleanTsv: string) {
		errors = [];
		const lines = cleanTsv.split('\n');
		const headers = lines.shift()!.split('\t');
		const sbvs: { name: string; sbv: string }[] = [];
		for (let col = 2; col < headers.length; col++) {
			const name = headers[col];
			const captions = lines
				.map((line, i) => {
					const parts = line.split('\t');
					const text = parts[col];
					try {
						const caption = {
							start: normalizeTime(parts[0]),
							end: normalizeTime(parts[1]),
							text: text || ''
						};
						return caption;
					} catch (err: any) {
						errors.push(`Error parsing line ${i + 1}: ${err.message}`);
					}
				})
				.filter(Boolean);
			const sbv = captions.map((cap) => {
				if (!cap) return '';
				return `${cap.start},${cap.end}\n${cap.text}\n`;
			});
			sbvs.push({ name, sbv: sbv.join('\n') });
		}
		return sbvs;
	}

	function normalizeTime(time: string) {
		time = time.trim();
		if (!time) {
			throw new Error('Empty time value');
		}
		const parts = time.match(
			/(?:(?:(?<hours>\d+):)?(?<minutes>\d+):)?(?<seconds>\d+)(?:\.(?<millis>\d+))?/
		);
		if (!parts) {
			throw new Error(`Invalid time format: "${time}"`);
		}
		const hours = parts.groups?.hours || '0';
		const minutes = parts.groups?.minutes || '0';
		const seconds = parts.groups?.seconds || '0';
		const millis = parts.groups?.millis || '0';
		return `${hours}:${minutes.padStart(2, '0')}:${seconds.padStart(2, '0')}.${millis.padStart(
			3,
			'0'
		)}`;
	}
</script>

<main>
	<h1>Captions from TSV (Tab-separated values)</h1>
	<p>
		If you've got a Google Sheet or similar file with captions in it, you can paste them here to get
		a <a
			href="https://support.google.com/youtube/answer/2734698?hl=en#zippy=%2Cbasic-file-formats%2Csubrip-srt-example%2Csubviewer-sbv-example"
			>YouTube-compatible SBV file</a
		>.
	</p>
	<p>Data is expected to have a header row, and the following column format</p>
	<ul>
		<li>Column 1: Start time (format <code>0:00:00.000</code> (hr:min:sec.millis))</li>
		<li>Column 2: End time (format <code>0:00:00.000</code>)</li>
		<li>
			Column 3-N: Caption text (each subsequent column could be a different language, the headers
			for these columns wills be used as the download name)
		</li>
	</ul>
	<p style="font-style:italic">
		The time format must match the regex pattern <code>{timePattern.source}</code>
	</p>
	<p>
		In your spreadsheet, you can use a data validator with the custom formula
		<code>regexmatch(A2,"{timePattern.source}")</code>
	</p>

	{#if sbvs.length}
		<section class="sbvs">
			<h2>SBV Files</h2>
			<ul>
				{#each sbvs as { name, sbv }}
					<li>
						<a download="{name}.sbv" href="data:text/plain;charset=utf-8,{encodeURIComponent(sbv)}"
							>{name}</a
						>
					</li>
				{/each}
			</ul>
		</section>
	{/if}

	{#if errors.length > 0}
		<section class="errors">
			<h2>Errors</h2>
			<ul>
				{#each errors as error}
					<li>{error}</li>
				{/each}
			</ul>
		</section>
	{/if}

	<textarea placeholder="Paste your TSV content here!" rows="10" bind:value={tsv}></textarea>
</main>

<style>
	main {
		max-width: 800px;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}
	code {
		font-family: monospace;
		font-size: 90%;
		display: inline-block;
	}
	textarea {
		width: 100%;
		field-sizing: content;
		min-height: 10em;
	}
	section.errors {
		color: red;
	}
</style>
