<script lang="ts">
  import { page } from '$app/stores';
  import type { SvelteComponent } from 'svelte';
  import { fade } from 'svelte/transition';
  import Sidebar from './Sidebar.svelte';
  import Workspace from './Workspace.svelte';

  let sidebar: SvelteComponent;
</script>

<div id="stitch-desktop" transition:fade={{ delay: 100 }}>
  <Sidebar bind:this={sidebar} on:click={sidebar.focus()} />

  <!-- Main Slot (changes by URL) -->
  {#key $page.url.pathname}
    <Workspace><slot /></Workspace>
  {/key}
</div>

<style>
  /* Main content container */
  #stitch-desktop {
    display: grid;
    grid-template-columns: 10em 1fr;
    height: 100vh;
    overflow: hidden;
    width: 100%;
  }
</style>
