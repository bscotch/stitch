<script lang="ts">
	import { config, links } from '$lib/stores.js';

	const utmFields = ['utmSource', 'utmMedium', 'utmCampaign', 'utmTerm', 'utmContent'] as const;
</script>

<section>
	<h3>UTM Link Generator</h3>

	<p>
		See the <a href="https://partner.steamgames.com/doc/marketing/utm_analytics">Steam UTM docs</a>
		and <a href="https://en.wikipedia.org/wiki/UTM_parameters#UTM_parameters">Wikipedia</a> for reference.
	</p>

	<p><b>UTM Link:</b> <code id="generated-utm-link">{$links.utmLink}</code></p>

	{#if !$config.utmSource && !$config.utmCampaign}
		<p class="warning">
			Must include either <code>utm_source</code> or <code>utm_campaign</code>.
		</p>
	{/if}

	<form>
		{#each utmFields as field}
			<label for={field}>{field.replace(/^utm/, '')}</label>
			<input
				name={field}
				value={$config[field] || ''}
				on:change={(e) => config.setField(field, e.currentTarget.value)}
				type="text"
			/>
		{/each}
	</form>
</section>

<style>
	form {
		display: grid;
		grid-template-columns: max-content max-content;
		gap: 0.5rem;
		align-items: center;
	}
	form label {
		text-align: right;
		font-weight: bold;
	}
	#generated-utm-link {
		font-size: 1.2em;
		margin-left: 0.25em;
		color: var(--color-result);
		/* Make it so that the whole thing gets selected at once */
		user-select: all;
	}
</style>
