<script lang="ts">
  import { createEventDispatcher, onMount, tick } from 'svelte';
  import type { GameMakerVersionData } from '../api.js';
  import Icon from '../Icon.svelte';
  import { state } from '../store.js';
  import { isNewer, toDateIso, toDateLocal } from '../util/dates.js';
  import {
    ideAnchorId,
    releaseAnchorId,
    runtimeAnchorId,
    type Channel,
  } from './constants.js';
  import FilteredReleases from './FilteredReleases.svelte';
  import NoteGroup from './NoteGroup.svelte';
  import ReleaseVersion from './ReleaseVersion.svelte';

  // Dispatch an event called 'selected' when a release is selected.
  const dispatch = createEventDispatcher<{
    choose: { release: string; ideVersion: string; runtimeVersion: string };
  }>();

  export let showChannels: Channel[] = ['lts', 'stable', 'beta'];
  export let releases: GameMakerVersionData[];

  /**
   * The IDE version of a release that is considered
   * "selected". The selected release is highlighted,
   * and other releases have a button to allow selecting
   * them instead.
   */
  export let selected: string | null = null;

  let filteredReleases: GameMakerVersionData[] = [];

  let oldestRead: Date | undefined;
  $: oldestRead = $state.gameMakerReleasesUnreadAfter
    ? new Date($state.gameMakerReleasesUnreadAfter)
    : undefined;

  function isUnread(release: GameMakerVersionData) {
    return (
      oldestRead &&
      release.channel !== 'unstable' &&
      isNewer(release.ide.publishedAt, oldestRead)
    );
  }

  onMount(async () => {
    // Scroll to the selected element
    if (!selected) {
      return;
    }
    await tick();
    // Update the last-read release date
    state.update(
      'gameMakerReleasesUnreadAfter',
      toDateIso(releases.find((r) => r.channel != 'unstable')!.publishedAt),
    );
    const anchor = document.querySelector(
      `#gamemaker-releases-component article.release[data-is-selected="true"]`,
    );
    if (!anchor) {
      return;
    }
    anchor.scrollIntoView({ behavior: 'smooth' });
  });
</script>

<section id="gamemaker-releases-component">
  <FilteredReleases bind:showChannels bind:releases bind:filteredReleases />

  {#each filteredReleases as release}
    {@const isSelected = selected === release.ide.version}
    <article
      class="release"
      data-version={release.ide.version}
      data-channel={release.channel}
      data-is-selected={isSelected}
      data-is-unread={isUnread(release)}
    >
      <header>
        <h2
          id={releaseAnchorId(release)}
          title={`Release ${release.ide.version} (${release.channel} channel)`}
        >
          {#if isUnread(release)}
            <span class="is-unread-badge">
              <Icon icon="notifications" label="New Release!" />
            </span>
          {/if}
          <span class="versions">
            <span class="ide">
              {release.ide.version}
              <span class="label">(IDE)</span>
            </span>
            <span class="runtime">
              {release.runtime.version}
              <span class="label">(Runtime)</span>
            </span>
          </span>
        </h2>

        <span>
          {#if release.ide.installed}
            <Icon icon="download" label="downloaded" />
          {/if}
        </span>
        {#if !isSelected}
          <button
            title="Switch to this GameMaker version"
            on:click={() =>
              dispatch('choose', {
                release: release.ide.version,
                runtimeVersion: release.runtime.version,
                ideVersion: release.ide.version,
              }) && (selected = release.ide.version)}
          >
            use
          </button>
        {:else}
          <span />
        {/if}

        <time datetime={toDateIso(release.publishedAt)}>
          <span class="sr-only">Release Date:</span>
          {toDateLocal(release.publishedAt)}
        </time>
      </header>
      <details>
        <summary><h3>Summary</h3></summary>
        <section class="release-summary">
          {@html release.summary}
        </section>
      </details>
      {#if release.runtime.notes.groups.length}
        <details>
          <summary>
            <h3 id={runtimeAnchorId(release)}>Runtime Changes</h3>
          </summary>
          <section>
            <ReleaseVersion artifact={release.runtime} />
            {#each release.runtime.notes.groups as group}
              <NoteGroup {group} />
            {/each}
          </section>
        </details>
      {/if}
      {#if release.ide.notes.groups.length}
        <details>
          <summary>
            <h3 id={ideAnchorId(release)}>IDE Changes</h3>
          </summary>
          <section>
            <ReleaseVersion artifact={release.ide} />
            {#each release.ide.notes.groups as group}
              <NoteGroup {group} />
            {/each}
          </section>
        </details>
      {/if}
    </article>
  {/each}
</section>

<style>
  #gamemaker-releases-component {
    color: var(--color-text);
    background-color: var(--color-background);
    display: flex;
    flex-direction: column;
    gap: 1.5em;
  }
  /* CHANNEL PILLS */
  [data-channel='lts'] {
    --channel-color: var(--color-channel-lts);
  }
  [data-channel='stable'] {
    --channel-color: var(--color-channel-stable);
  }
  [data-channel='beta'] {
    --channel-color: var(--color-channel-beta);
  }
  [data-channel='unstable'] {
    --channel-color: var(--color-channel-unstable);
  }

  /* SELECTED */
  [data-is-selected='true'] {
    border: 0.1em solid var(--channel-color);
    padding-block-start: 0.25em;
    padding-block-end: 0.75em;
    padding-inline: 0.75em;
    border-radius: 0.5em;
  }

  /* article header h2 .versions .runtime {
    font-size: 0.8em;
    color: var(--color-text-subtle);
  } */

  .is-unread-badge {
    padding-inline: 0.2em;
    display: inline-block;
    border-radius: 50%;
    background-color: var(--color-highlight);
    color: var(--color-background);
    font-size: 0.6em;
    user-select: none;
  }

  /* RELEASE */

  article header {
    display: grid;
    grid-template-columns: 1fr 1em 3em 5.5em;
    gap: 0.5em;
    align-items: center;
  }

  article header h2 {
    color: var(--channel-color);
    font-size: 1.3em;
    display: inline-flex;
    align-items: center;
    gap: 0.5em;
  }

  article header h2 .versions {
    display: flex;
    flex-direction: column;
    gap: 0;
    line-height: 1em;
  }

  article header h2 .versions .label {
    font-size: 0.8em;
    color: var(--color-text-quiet);
    /* font-weight: 400; */
    /* font-style: italic; */
  }

  article header h2 .versions .runtime {
    font-size: 0.8em;
    color: var(--color-text-subtle);
  }

  article header time {
    color: var(--color-text-subtle);
  }

  article header button {
    background-color: var(--color-background);
    color: var(--color-text-subtle);
    border: 0.15em solid var(--color-text-subtle);
    border-radius: 0.75em;
    padding-inline: 0.5em;
    padding-block: 0 0.1em;
    font-size: 0.6em;
    font-weight: bold;
    cursor: pointer;
  }
  article header button:hover {
    color: var(--color-text);
    border-color: var(--color-text);
  }

  details summary {
    cursor: pointer;
    font-size: 1em;
  }
  details summary h3 {
    font-size: 1em;
    user-select: none;
    display: inline;
  }
  details > section {
    padding-left: 1em;
    padding-block: 0 0.75em;
  }
  details > section.release-summary {
    display: flex;
    flex-direction: column;
    gap: 0.5em;
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
