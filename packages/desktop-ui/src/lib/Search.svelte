<script lang="ts">
  import Fuse from 'fuse.js';
  import { createEventDispatcher } from 'svelte';
  import { slide } from 'svelte/transition';

  type T = $$Generic;

  const dispatch = createEventDispatcher<{
    results: T[];
  }>();

  export let items: T[];
  export let keys: (string | { name: string; weight: number })[];

  /**
   * Optionally bind the query string
   */
  export let query = '';

  /**
   * Updated upon search. Should be treated as readonly.
   * Can be bound instead of using `on:results`.
   */
  export let results: T[] = [];

  const fuse = new Fuse(items, {
    keys,
    includeScore: true,
    minMatchCharLength: 2,
  });

  let lastQuery: undefined | string;
  function updateItems() {
    lastQuery = query;
    results = query.trim() ? fuse.search(query).map((r) => r.item) : items;

    dispatch('results', results);
  }
</script>

<input
  transition:slide
  type="search"
  placeholder="Filter"
  bind:value={query}
  on:keyup={updateItems}
/>

<style>
  input[type='search'] {
    display: block;
    border-radius: 0.5em;
    border-style: solid;
    padding: 0 0.5em;
    background-color: var(--color-background);
    color: var(--color-text);
    width: 100%;
  }
</style>
