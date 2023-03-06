<script lang="ts">
  import type { GameMakerVersionData } from '../api.js';
  import Checkbox from '../Checkbox.svelte';
  import { channels, type Channel } from './constants.js';

  export let showChannels: Channel[] = ['lts', 'stable'];
  export let releases: GameMakerVersionData[];
  export let filteredReleases: GameMakerVersionData[] = [];

  function updateFilteredReleases() {
    filteredReleases = releases.filter((release) =>
      showChannels.includes(release.channel),
    );
  }

  updateFilteredReleases();
</script>

<form>
  <h2 class="sr-only">Filter display GameMaker Releases</h2>

  <fieldset>
    <legend class="sr-only"> Select which channels to display </legend>
    {#each channels as channel}
      <Checkbox
        label={channel}
        value={channel}
        data={{ channel }}
        --color-checkbox-text={`var(--color-background)`}
        --color-checkbox-background={`var(--color-channel-${channel})`}
        bind:values={showChannels}
        on:change={() => {
          updateFilteredReleases();
        }}
      />
    {/each}
  </fieldset>
</form>

<style>
  form {
    display: flex;
    flex-direction: row;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5em;
  }
  form fieldset {
    display: flex;
    flex-direction: row;
    gap: 0.25em;
    align-items: center;
    margin: 0;
    padding: 0;
    border: none;
  }

  /* https://tailwindcss.com/docs/screen-readers */
  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border-width: 0;
  }
</style>
