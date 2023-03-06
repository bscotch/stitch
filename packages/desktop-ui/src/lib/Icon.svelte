<script lang="ts">
  import type { IconId } from './types.js';

  export let icon: IconId;
  export let label: string | undefined = undefined;
</script>

<span>
  {#if label}
    <span class="sr-only">{label}</span>
  {/if}
  <span title={label} class="material-symbols-sharp icon" aria-hidden>
    {icon}
  </span>
</span>

<style>
  .icon {
    color: var(--color, currentColor);
    font-size: 1em;
    vertical-align: -0.1em;
    font-weight: var(--font-weight, 500);
  }
</style>
