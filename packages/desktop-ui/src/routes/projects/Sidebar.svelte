<script lang="ts">
  import type { ProjectSummary } from '$lib/api.js';
  import Button from '$lib/Button.svelte';
  import { flip } from 'svelte/animate';
  import { slide } from 'svelte/transition';

  import Icon from '$lib/Icon.svelte';
  import { currentProjectId, projects } from '$lib/store.js';
  import { createAddFromFolderMachine } from '$lib/util/addFromFolder.js';
  import Settings from './Settings.svelte';
  import SidebarProject from './SidebarProject.svelte';

  const addProjectsActor = createAddFromFolderMachine({
    alertId: 'add-projects',
    addFromFolder: async (dir) => await projects.addFromDirectory(dir),
    buttonLabel: 'Find Projects',
    title: 'Add Projects',
    message:
      'Stitch will search the selected folder for GameMaker projects, and add all that it finds.',
  });

  let sortedProjects: ProjectSummary[] = [];
  $: {
    sortedProjects = [...$projects].sort(compareProjects($currentProjectId));
  }

  function compareProjects(id: string | undefined | null) {
    return (a: ProjectSummary, b: ProjectSummary) => {
      if (a.id === id) {
        return -1;
      } else if (b.id === id) {
        return 1;
      }
      return a.name.localeCompare(b.name);
    };
  }

  async function handleHotkeys(event: KeyboardEvent) {
    if (event.key === 'Delete') {
      // Are we hovering over a project in the list?
      const hoveredProjects = document.querySelectorAll(
        '[data-type="sidebar-project-entry"]:hover',
      );
      if (hoveredProjects.length !== 1) {
        return;
      }
      const projectId = hoveredProjects[0].getAttribute('data-projectId');
      if (projectId) {
        await projects.removeById(projectId);
      }
    }
  }
</script>

<svelte:window on:keyup={handleHotkeys} />

<nav id="sidebar" class="pad scroller" aria-label="Stitch app navigation menu">
  <!-- svelte-ignore a11y-no-noninteractive-tabindex -->
  <section
    tabindex="0"
    class="sidebar-section"
    aria-labelledby="sidebar-projects-header"
  >
    <header class="projects-header">
      <h2 class="section-heading">Projects</h2>
      <ul
        class="reset actions-container"
        aria-label="Project management actions"
      >
        <li>
          <button
            title="Add Projects"
            on:click={() => addProjectsActor.send('chooseFolder')}
          >
            <Icon icon="add_circle" />
          </button>
        </li>
        <li>
          <Button
            title="Refresh Projects"
            icon="refresh"
            onClick={() => projects.reloadProjects()}
          />
        </li>
      </ul>
    </header>
    <ul class="reset project-list">
      {#if $addProjectsActor.matches('searchingFolder')}
        <li class="searching append-animated-ellipsis" transition:slide>
          Searching for projects
        </li>
      {/if}
      {#each sortedProjects as project (project.id)}
        <li
          animate:flip={{ duration: 100 }}
          transition:slide|local={{ duration: 50 }}
        >
          <SidebarProject {project} />
        </li>
      {/each}
    </ul>
  </section>

  <footer>
    <Settings />
  </footer>
</nav>

<style>
  nav {
    --color-background-subtle: rgb(35, 35, 35);
    --color-text: #d9d9d9;
    --color-text-subtle: #959595;
    color: var(--color-text-subtle);
    padding: 0.5rem 1rem;
    background-color: var(--color-background-subtle);
    max-height: 100vh;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
  }
  .actions-container {
    --color: var(--color-link);
    --font-size: 1em;
    display: inline-flex;
    flex-direction: row;
    gap: 0.2em;
  }
  button {
    --color: var(--color-text-subtle);
  }
  .searching {
    font-style: italic;
  }
  .projects-header {
    display: flex;
    justify-content: space-between;
    gap: 0.5em;
  }
  footer {
    font-size: 1em;
  }
  .section-heading {
    font-size: var(--u-90);
    text-transform: uppercase;
    font-weight: var(--font-weight-boldest);
  }
  .project-list {
    margin-top: 0.25em;
    display: flex;
    flex-direction: column;
    gap: 0.5em;
  }
</style>
