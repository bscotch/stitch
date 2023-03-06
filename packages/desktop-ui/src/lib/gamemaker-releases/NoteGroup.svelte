<script lang="ts">
  import type { GameMakerReleaseWithNotes } from '@bscotch/gamemaker-releases';

  type NoteGroup =
    GameMakerReleaseWithNotes['runtime']['notes']['groups'][number];

  export let group: NoteGroup;
</script>

<details>
  <summary>
    <h4>{group.title}</h4>
  </summary>
  <ul>
    {#each group.changes as change}
      <li>{@html change}</li>
    {/each}
  </ul>
</details>

<style>
  summary {
    color: var(--color-text-subtle);
  }
  h4 {
    font-size: 1em;
    margin: 0;
    padding: 0;
    font-style: italic;
    display: inline;
    user-select: none;
    cursor: pointer;
  }
  ul {
    /* list-style: none; */
    /* margin: 0; */
    /* padding: 0; */
    padding-left: 1.75em;
  }
  li {
    padding-block: 0.25em;
  }
  li::marker {
    color: var(--color-text-subtle);
  }
</style>
