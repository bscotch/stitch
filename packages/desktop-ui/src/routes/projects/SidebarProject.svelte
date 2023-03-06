<script lang="ts">
  import { page } from '$app/stores';
  import type { ProjectSummary } from '$lib/api.js';
  import { getProjectIcon } from '$lib/util/projectIcon.js';

  export let project: ProjectSummary;
  let imageUrl = getProjectIcon(project, 200)?.url;

  let open = false;
  $: open = $page.params.projectId === project.id;
</script>

<a
  class="reset editor-link select-none"
  href={`/projects/${project.id}`}
  data-projectId={project.id}
  data-type="sidebar-project-entry"
  data-open={open}
  aria-selected={open}
>
  {#if imageUrl}
    <img src={getProjectIcon(project, 200)?.url} alt="Game Icon" />
  {/if}
  <span class="name">{project.name}</span>
</a>

<style>
  a {
    --shadow-width: 0.5em;
    --shadow-width-negative: calc(var(--shadow-width) * -1);
    display: flex;
    align-items: center;
    flex-direction: column;
  }
  img {
    transition: filter 150ms ease-in-out;
  }
  [aria-selected='false'] img {
    filter: grayscale(100%);
  }
  [aria-selected='false']:hover img {
    filter: grayscale(80%);
  }
  img {
    width: 5em;
    border-radius: 1.5em;
    height: auto;
    display: inline-block;
  }
  [data-open='true'].editor-link {
    color: var(--color-text);
  }
  .editor-link {
    color: var(--color-text-subtle);
  }
  .editor-link:hover:not(.open) {
    color: var(--color-text);
  }
</style>
