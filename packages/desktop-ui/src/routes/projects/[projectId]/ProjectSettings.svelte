<script lang="ts">
  import { trpc, type ProjectSummary } from '$lib/api.js';
  import Icon from '$lib/Icon.svelte';
  import { currentProject, projects } from '$lib/store.js';
  import AssetSources from './AssetSources.svelte';

  async function setIdeVersion(version: string) {
    await trpc.setProjectIdeVersion.mutate({
      projectId: $currentProject!.id,
      version,
    });
  }
  let project: ProjectSummary;
  $: {
    project = $currentProject!;
  }
</script>

<AssetSources />

<section>
  <button on:click={() => projects.removeById(project.id)}>
    <Icon icon="link_off" />
    <span> Remove from projects </span>
  </button>
</section>

<style>
  button {
    color: var(--color-text-subtle);
  }
  button:hover {
    color: var(--color-text-danger);
  }
</style>
