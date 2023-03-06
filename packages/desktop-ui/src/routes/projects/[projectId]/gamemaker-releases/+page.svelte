<script lang="ts">
  import { trpc } from '$lib/api.js';
  import GameMakerReleases from '$lib/gamemaker-releases/GameMakerReleases.svelte';
  import Section from '$lib/Section.svelte';
  import { currentProject } from '$lib/store.js';
  import type { ProjectSummary } from '@bscotch/stitch-server/client';

  let releasesWait = trpc.listGameMakerReleases.query();
  let project: ProjectSummary;
  $: {
    project = $currentProject!;
  }

  async function setIdeVersion(version: string) {
    await trpc.setProjectIdeVersion.mutate({
      projectId: $currentProject!.id,
      version,
    });
  }
</script>

<Section
  actions={[
    {
      icon: 'close',
      label: 'Close',
      onClick: () => {
        history.back();
      },
    },
  ]}
>
  <h1 slot="header">GameMaker Releases</h1>
  <div slot="body">
    {#await releasesWait}
      <p>Loading releases...</p>
    {:then releases}
      <p>
        Review GameMaker releases below, and optionally choose a different one
        for
        <b>{project.name}</b>.
      </p>
      <GameMakerReleases
        {releases}
        bind:selected={project.ideVersion}
        on:choose={(e) => setIdeVersion(e.detail.ideVersion)}
      />
    {/await}
  </div>
</Section>
