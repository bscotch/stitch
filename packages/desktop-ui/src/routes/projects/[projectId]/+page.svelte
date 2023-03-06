<script lang="ts">
  import { trpc, type ProjectSummary } from '$lib/api.js';
  import Icon from '$lib/Icon.svelte';
  import { currentProject, currentProjectId } from '$lib/store.js';
  import type { IconId } from '$lib/types.js';
  import { stitchVersion } from '$lib/util/info.js';
  import GameMakerReleaseNotice from './GameMakerReleaseNotice.svelte';
  import ProjectSettings from './ProjectSettings.svelte';

  interface Action {
    label: string;
    icon: IconId;
    action: () => void;
  }

  const actions: Action[] = [
    {
      label: 'Open in GameMaker',
      icon: 'play_circle',
      action: () => {
        trpc.openProject.query({
          projectId: $currentProjectId!,
          app: 'game-maker',
        });
      },
    },
    {
      label: 'Open in VS Code',
      icon: 'code_blocks',
      action: () => {
        trpc.openProject.query({ projectId: $currentProjectId!, app: 'code' });
      },
    },
    {
      label: 'Open in File Explorer',
      icon: 'folder_open',
      action: () => {
        trpc.openProject.query({
          projectId: $currentProjectId!,
          app: 'explorer',
        });
      },
    },
  ];

  let project: ProjectSummary;
  $: {
    project = $currentProject!;
  }
</script>

<svelte:head>
  <title>{project.name} | Stitch {stitchVersion}</title>
</svelte:head>

<h1>
  {project.name}
</h1>

<section class="actions">
  <h2 class="sr-only">Launchers and management actions</h2>
  <ul class="reset action-list">
    {#each actions as action}
      <li class="action-container">
        <button class="reset" on:click={action.action}>
          <span class="icon">
            <Icon icon={action.icon} />
          </span>
          <span class="description">
            {action.label}
          </span>
        </button>
      </li>
    {/each}
  </ul>
  <GameMakerReleaseNotice />
</section>

<section class="editor">
  <ProjectSettings />
</section>

<style>
  .editor {
    display: flex;
    flex-direction: column;
    max-width: 30em;
    width: 100%;
    gap: var(--editor-widget-gap);
  }
  section + section {
    margin-top: var(--editor-widget-gap);
  }
  .action-list {
    display: flex;
    flex-wrap: wrap;
    flex-direction: row;
    font-size: 0.8em;
    gap: 1em;
  }
  .action-container button {
    --border-color: var(--color-text-subtle);
    display: flex;
    justify-content: flex-start;
    width: 8em;
    height: 8em;
    flex-direction: column;
    border: 1px solid var(--border-color);
    box-shadow: 0 0 5px var(--border-color);
    border-radius: 0.5em;
    color: var(--color-text);
    padding: 0 0.5em;
  }
  .action-container button:hover {
    --border-color: var(--color-link-hover);
    color: var(--border-color);
  }
  .action-container button .icon {
    font-size: 3em;
    align-self: center;
  }
</style>
