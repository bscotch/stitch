<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  type T = $$Generic;

  const dispatch = createEventDispatcher<{
    change: T extends undefined ? boolean : T[];
  }>();

  export let values: T[] | undefined = undefined;
  export let value: T | undefined = undefined;
  export let checked = values?.includes(value as any) ?? false;
  export let label = '';

  function change() {
    if (Array.isArray(values)) {
      // Update the array, send it as an event
      if (!checked) {
        values = values.filter((x) => x !== value);
      } else {
        values = [...(values as any), value];
      }
      dispatch('change', values as any);
    } else {
      // Send the boolean state
      dispatch('change', checked as any);
    }
  }

  /**
   * Optionally specify data-* attributes to be added
   * to the <label> element.
   */
  export let data: Record<string, string | number | boolean> = {};

  const dataAttributes = Object.keys(data).reduce((acc, key) => {
    acc[`data-${key}`] = data[key];
    return acc;
  }, {} as Record<`data-${string}`, string | number | boolean>);
</script>

<label {...dataAttributes}>
  <input type="checkbox" {value} bind:checked on:change={change} />
  {#if label}
    {label}
  {/if}
</label>

<style>
  /* https://moderncss.dev/pure-css-custom-checkbox-style/ */
  label {
    user-select: none;
    cursor: pointer;
    display: inline-grid;
    grid-template-columns: 1em auto;
    gap: 0.25em;
    color: var(--color-checkbox-text);
    background-color: var(--color-checkbox-background);
    font-size: 0.75em;
    font-weight: bold;
    border-radius: 0.75em;
    padding-inline: 0.5em;
  }
  input {
    cursor: pointer;
    appearance: none;
    background-color: var(--color-checkbox-background);
    color: var(--color-checkbox-text);
    border: 0.2em solid var(--color-checkbox-text);
    border-radius: 0.2em;
    aspect-ratio: 1/1;
    width: 1em;
    display: grid;
    align-self: center;
    place-content: center;
  }
  input::before {
    content: '';
    width: 0.6em;
    aspect-ratio: 1/1;
    transform: scale(0);
    transition: 120ms transform ease-in-out;
    box-shadow: inset 1em 1em var(--color-checkbox-text);
    clip-path: polygon(14% 44%, 0 65%, 50% 100%, 100% 16%, 80% 0%, 43% 62%);
  }
  input:checked::before {
    transform: scale(1);
    /* background-color: var(--color-checkbox-background); */
  }
</style>
