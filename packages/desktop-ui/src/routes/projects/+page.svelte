<script lang="ts">
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { fade } from 'svelte/transition';
  import { currentProjectId } from '$lib/store.js';
  import Logo from '$lib/assets/stitch-logo-small.webp';

  $: {
    const projectId = $page.params.projectId;
    if (!projectId && $currentProjectId) {
      goto(`/projects/${$currentProjectId}`);
    }
  }
</script>

{#if !$currentProjectId}
  <article transition:fade={{ delay: 100, duration: 200 }}>
    <h1>Welcome to Stitch!</h1>
    <img src={Logo} alt="Stitch Logo" />
  </article>
{/if}

<style>
  article {
    display: inline-flex;
    flex-direction: column;
    align-items: center;
  }
</style>
