<script lang="ts">
  import { createEventDispatcher, tick } from 'svelte';
  import Icon from './Icon.svelte';
  import type { SectionAction } from './types.js';

  export let open = true;
  export let expandable = false;
  export let actions: SectionAction[] = [];

  const dispatch = createEventDispatcher<{
    closed: true;
    opened: true;
    changed: { open: boolean };
  }>();

  function toggle() {
    if (!expandable) {
      return;
    }
    open = !open;
    dispatch('changed', { open });
    dispatch(open ? 'opened' : 'closed');
  }

  if (open && expandable) {
    tick().then(() => dispatch('opened'));
  }
</script>

<section>
  <header>
    <div class="text">
      {#if expandable}
        <button class="reset toggle" on:click={() => toggle()}>
          <Icon
            icon={open ? 'expand_more' : 'chevron_right'}
            label={open ? 'Show less' : 'Show more'}
          />
        </button>
      {/if}
      <!-- svelte-ignore a11y-click-events-have-key-events -->
      <span on:click={() => toggle()}>
        <slot name="header" />
      </span>
    </div>
    {#if actions.length}
      <menu class="reset">
        {#each actions as action}
          <li>
            <button title={action.label} on:click={action.onClick}>
              <Icon icon={action.icon} />
            </button>
          </li>
        {/each}
      </menu>
    {/if}
  </header>

  {#if open}
    <slot name="body" />
  {/if}
</section>

<style>
  section {
    --color-header: var(--color-header, var(--color-text, inherit));
    --color-toggle: var(--color-toggle, var(--color-header));
    --color-action: var(--color-action, var(--color-toggle));
  }
  header {
    display: flex;
    justify-content: space-between;
    gap: 0.5em;
    color: var(--color-header);
  }
  header .text {
    display: flex;
    align-items: center;
    gap: 0.5em;
    color: var(--color-header);
  }
  .toggle {
    margin: 0 -0.2em;
    color: var(--color-toggle);
  }
  menu {
    --font-size: 1em;
    align-self: center;
    display: inline-flex;
    flex-direction: row;
    gap: 0.2em;
  }

  menu button {
    --color: var(--color-action);
  }
</style>
