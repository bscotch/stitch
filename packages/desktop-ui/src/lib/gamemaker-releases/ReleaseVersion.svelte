<script lang="ts">
  import type { GameMakerVersionData } from '@bscotch/stitch-server/client';

  type Artifact = GameMakerVersionData['ide'];

  export let artifact: Artifact;
</script>

<p>
  <span class="version current">
    v{artifact.version}
  </span>
  {#if artifact.notes.since}
    <span class="since">
      (since
      <span class="version"> v{artifact.notes.since}</span>)
    </span>
  {/if}
</p>

<style>
  p {
    color: var(--color-text-subtle);
    font-size: 0.9em;
    word-spacing: 0.2em;
  }
  .version {
    font-weight: bold;
    font-family: var(--font-family-mono);
  }
  .current {
    color: var(--color-text);
  }
</style>
