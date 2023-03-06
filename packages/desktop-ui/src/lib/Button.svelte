<script lang="ts">
  import Icon from './Icon.svelte';
  import type { IconId } from './types.js';
  export let onClick: () => void;
  /**
   * If set, the text displayed on the button
   */
  export let text: string | undefined = undefined;
  export let icon: IconId | undefined = undefined;
  /**
   * If set, the hover-text to display
   */
  export let title: string | undefined = undefined;
  export let tabindex = 0;
</script>

<button tabindex={tabindex ?? 0} class="reset" on:click={onClick} {title}>
  <span>
    {#if icon}<Icon {icon} />{/if}
    <slot name="icon" />
  </span>
  <span>
    {#if text}{text}{/if}
    <slot name="text" />
  </span>
</button>

<style>
  button {
    --color: var(--color, inherit);
    color: var(--color);
    border-width: var(--border-width, 0);
    border-color: var(--border-color, currentColor);
    font-size: var(--font-size, 0.9em);
    padding: var(--padding, 0);
    font-weight: var(--font-weight-bold);
  }
  button:hover {
    --color: var(--color-hover, var(--color-link-hover, inherit));
  }
</style>
