<script lang="ts">
  import { page } from '$app/stores';
  import { currentProject, state } from '$lib/store.js';
  import { stitchVersion } from '$lib/util/info.js';
  import type { ProjectSummary } from '@bscotch/stitch-server/client';

  state.update('currentProjectId', $page.params.projectId);

  let project: ProjectSummary;
  $: {
    project = $currentProject!;
  }
</script>

<svelte:head>
  <title>{project.name} | Stitch {stitchVersion}</title>
</svelte:head>

<slot />
