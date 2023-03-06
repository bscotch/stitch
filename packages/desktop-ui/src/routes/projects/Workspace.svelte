<script lang="ts">
  import { fly } from 'svelte/transition';

  let main: HTMLElement;
</script>

<!-- svelte-ignore a11y-click-events-have-key-events -->
<!-- svelte-ignore a11y-no-noninteractive-tabindex -->
<main
  tabindex="0"
  class="pad no-scroll"
  in:fly={{ duration: 300, y: -100, delay: 0 }}
  bind:this={main}
  on:click|self={() => main.focus()}
>
  <section class="scroller"><slot /></section>
</main>

<style>
  main {
    --color-text: #d9d9d9;
    --color-text-subtle: #959595;
    --color-text-quiet: #747474;
    --color-text-error: rgb(205, 9, 107);
    --color-highlight: rgb(193, 0, 193);
    color: var(--color-text);
    background-color: var(--color-background);
    height: 100vh;
    display: grid;
    grid-template-rows: auto min-content;
    width: 100%;
    border-right: 0.1em solid rgb(26, 26, 26);
  }
  section {
    padding: 0.75rem 1.5rem;
  }
</style>
