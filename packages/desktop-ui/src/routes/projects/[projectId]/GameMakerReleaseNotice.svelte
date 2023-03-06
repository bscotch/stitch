<script lang="ts">
  import { trpc } from '$lib/api.js';
  import Icon from '$lib/Icon.svelte';
  import { gameMakerReleasesUrl } from '$lib/paths.js';
  import { currentProject, state } from '$lib/store.js';
  import { isNewer } from '$lib/util/dates.js';
  import { onDestroy } from 'svelte';
  import { scale } from 'svelte/transition';

  let newReleaseCount = 0;

  async function checkForGameMakerUpdates() {
    const { gameMakerReleasesUnreadAfter } = $state;
    if (!gameMakerReleasesUnreadAfter) {
      return;
    }

    const releases = await trpc.listGameMakerReleases.query();
    const newReleases = releases.filter(
      (release) =>
        release.channel !== 'unstable' &&
        isNewer(release.publishedAt, gameMakerReleasesUnreadAfter),
    );
    newReleaseCount = newReleases.length;
  }

  checkForGameMakerUpdates();
  let gameMakerUpdatesPoller = setInterval(
    checkForGameMakerUpdates,
    1000 * 60 * 20,
  );
  onDestroy(() => {
    clearInterval(gameMakerUpdatesPoller);
  });

  const project = $currentProject!;
</script>

<p>
  Using GameMaker <a
    title="Change or read about this GameMaker release"
    href={gameMakerReleasesUrl(project.id)}
  >
    {project.ideVersion}
  </a>
  {#if newReleaseCount}
    <a
      transition:scale
      class="badge"
      href={gameMakerReleasesUrl(project.id)}
      title="Read about the latest GameMaker releases"
    >
      <Icon icon="notifications" />
      <span class="count">{newReleaseCount}</span>
    </a>
  {/if}
</p>

<style>
  a.badge {
    text-decoration: none;
    background-color: var(--color-highlight);
    color: var(--color-background);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    /* font-weight: bold; */
    border-radius: 0.5em;
    padding-inline: 0.25em;
    font-size: 0.8em;
    transform: scale(1) rotate(0deg);
    animation: 2s ease-in-out infinite pulse;
  }

  @keyframes pulse {
    0% {
      transform: scale(1) rotate(0deg);
    }
    25% {
      transform: scale(1.1) rotate(5deg);
    }
    50% {
      transform: scale(1) rotate(-5deg);
    }
    75% {
      transform: scale(1.1) rotate(5deg);
    }
    100% {
      transform: scale(1) rotate (0deg);
    }
  }
</style>
