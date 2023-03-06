<script lang="ts">
  import { trpc } from '$lib/api.js';
  import Section from '$lib/Section.svelte';
  import { currentProject } from '$lib/store.js';
  import { createAddFromFolderMachine } from '$lib/util/addFromFolder.js';
  import type { ProjectSummary } from '@bscotch/stitch-server/client';
  import { slide } from 'svelte/transition';
  import Icon from '../../../lib/Icon.svelte';

  import AssetSource from './AssetSource.svelte';

  const addFromFolderActor = createAddFromFolderMachine({
    alertId: 'add-audio-source',
    addFromFolder: async (dir) => {
      await trpc.addAudioSource.mutate({
        projectId: $currentProject!.id,
        directory: dir,
      });
    },
    buttonLabel: 'Use Folder as Audio Source',
    title: 'Add Audio Source',
    message:
      'Specify a folder that contains audio files to import into a GameMaker project.',
  });

  let project: ProjectSummary;
  let audioSources: string[] = [];
  $: {
    project = $currentProject!;
    audioSources = Object.keys($currentProject!.sources.audio);
  }
</script>

<section>
  <Section
    actions={[
      {
        icon: 'add_circle',
        label: 'Add a new audio source',
        onClick: () => {
          addFromFolderActor.send('chooseFolder');
        },
      },
    ]}
  >
    <h3 slot="header">
      <Icon icon="volume_up" />
      Audio Sources
    </h3>
    <div slot="body" transition:slide>
      {#if $addFromFolderActor.matches('searchingFolder')}
        <p class="searching append-animated-ellipsis" transition:slide>
          Processing source files
        </p>
      {/if}
      <ul class="reset">
        {#each audioSources as audioSource (audioSource)}
          <li>
            <AssetSource
              projectId={project.id}
              id={audioSource}
              configPath={project.sources.audio[audioSource]}
            />
          </li>
        {/each}
      </ul>
    </div>
  </Section>
</section>
