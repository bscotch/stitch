<script lang="ts">
	// Keep a query parameter "steamid" in sync with the steamId variable
	import { type SteamLanguage, steamLanguages } from './langs.js';

	export let onselect: (lang: SteamLanguage | undefined) => void;
	export let initial: string | undefined;

	let selectedLanguageCode: string | undefined = initial;
</script>

<select
	id="language"
	name="language"
	bind:value={selectedLanguageCode}
	on:change={() => {
		const language = selectedLanguageCode
			? steamLanguages.find((lang) => lang.code === selectedLanguageCode)
			: undefined;
		onselect(language);
	}}
>
	<option value="">Language</option>
	{#each steamLanguages as lang}
		<option value={lang.code}>{lang.name}</option>
	{/each}
</select>
