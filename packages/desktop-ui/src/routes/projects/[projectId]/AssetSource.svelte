<script lang="ts">
  import {
    trpc,
    type Asset,
    type AudioAsset,
    type AudioSourceConfig,
    type DeletedAsset,
    type FileDifferenceType,
    type GroupedSourceConfig,
  } from '$lib/api.js';
  import Icon from '$lib/Icon.svelte';
  import Search from '$lib/Search.svelte';
  import Section from '$lib/Section.svelte';
  import { alerts } from '$lib/store.alerts.js';
  import { serverBaseUrl } from '$lib/util/info.js';
  import { slide } from 'svelte/transition';

  export let projectId: string;
  export let id: string;
  export let configPath: string;

  type Assets = GroupedSourceConfig<AudioSourceConfig> & {
    diff: { [id: string]: FileDifferenceType };
  };

  const type = 'audio';

  let assets: Assets | undefined = undefined;
  let query = '';
  let loading = false;
  let filtered: Assets['groups'] = [];

  let audioEl: HTMLAudioElement | undefined = undefined;
  function playSound(file: AudioAsset) {
    const url = `${serverBaseUrl}/projects/${projectId}/sources/${type}/${id}/files/${file.id}`;
    audioEl?.setAttribute('src', url);
    audioEl?.play();
  }

  let lastToggleWait = Promise.resolve();
  async function toggleImportability(
    files: (Asset | DeletedAsset)[],
    importable: boolean,
  ) {
    const fileIds = files.map((f) => f.id);
    // Set them locally
    files.forEach((f) => (f.importable = importable));
    if (assets) {
      // Trigger a re-render
      assets = { ...assets };
      filtered = [...filtered];
    }
    // Wait until the prior toggle is done
    lastToggleWait = lastToggleWait.then(() =>
      trpc.setAudioSourceImportability.mutate({
        id,
        fileIds,
        projectId,
        importable,
      }),
    );
  }

  async function loadAssets(force?: boolean) {
    if (loading) {
      return;
    }
    const alertId = 'loading-audio-source-' + id;
    try {
      loading = true;
      alerts.notify({
        id: alertId,
        text: 'Loading audio source...',
        kind: 'info',
      });
      const updatedAssets = await trpc.getAudioSource.query({
        projectId,
        id,
      });
      assets = updatedAssets;
      filtered = assets.groups;
      alerts.notify({
        id: alertId,
        text: 'Loaded audio source',
        kind: 'success',
        ttl: 3,
      });
    } catch (err) {
      assets = undefined;
      console.error(err);
      alerts.notify({
        id: alertId,
        text: 'Failed to load audio source',
        kind: 'error',
      });
    } finally {
      loading = false;
    }
  }
</script>

<Section
  expandable={true}
  open={false}
  on:opened={() => loadAssets()}
  actions={[
    {
      icon: 'publish',
      label: 'Import into project',
      onClick: async () => {
        const alertId = `importing-${id}`;
        alerts.notify({
          id: alertId,
          text: 'Importing sounds...',
          kind: 'info',
        });
        await trpc.importAudioFromSource.mutate({
          projectId,
          id,
        });
        await loadAssets(true);
        alerts.notify({
          id: alertId,
          text: 'Sounds imported!',
          kind: 'success',
          ttl: 5,
        });
      },
    },
    {
      icon: 'refresh',
      label: 'Refresh',
      onClick: () => loadAssets(true),
    },
    {
      icon: 'done_all',
      label: 'Mark all as importable',
      onClick: () => {
        toggleImportability(
          assets?.files.filter((x) => !x.importable && !x.deleted) || [],
          true,
        );
      },
    },
    {
      icon: 'code_blocks',
      label: 'Open configuration file',
      onClick: () => {
        trpc.openPath.query({ path: configPath });
      },
    },
    {
      icon: 'link_off',
      label: 'Delete this source',
      onClick: () => {
        trpc.removeAudioSource.mutate({ projectId, id });
      },
    },
  ]}
>
  <h4 slot="header">Sounds and Music</h4>
  <div class="source-container" slot="body">
    {#if assets}
      {#if !query}
        <p>
          Sorted by needs-review, then most-recently-updated. Filtered results
          are sorted by query relevance.
        </p>
      {/if}
      <Search
        items={assets.groups}
        keys={['name']}
        bind:query
        bind:results={filtered}
      />
      <audio bind:this={audioEl} />
      <ol transition:slide class="reset source-groups scroller boxed">
        {#each filtered as group (group.name)}
          {@const unimportableCount = group.files.filter(
            (x) => !x.deleted && !x.importable,
          ).length}
          {@const readyToImport = group.files.filter(
            (x) => x.importable && assets?.diff[x.id],
          )}
          <li
            class="source-group"
            data-unimportable={unimportableCount}
            data-ready-to-import={readyToImport.length}
            data-group={group.name ? group.name : undefined}
          >
            <Section expandable={true} open={unimportableCount > 0}>
              <h4 slot="header">
                {group.name || '[Ungrouped]'}
              </h4>
              <ol slot="body" class="reset source-files">
                {#each group.files.filter((x) => !x.deleted) as file (file.id)}
                  <li
                    data-importable={file.importable}
                    transition:slide|local={{ duration: 50 }}
                  >
                    <span class="buttons">
                      <button
                        class="importable-button"
                        title={file.importable
                          ? 'Mark as not importable'
                          : 'Mark as importable'}
                        on:click={() =>
                          !file.deleted &&
                          toggleImportability([file], !file.importable)}
                      >
                        <Icon
                          icon={file.importable
                            ? 'check_box'
                            : 'check_box_outline_blank'}
                        />
                      </button>
                      <button
                        on:click={() => {
                          !file.deleted && playSound(file);
                          toggleImportability([file], true);
                        }}
                        class="play-button"
                        title="Play sound"
                      >
                        <Icon icon="play_circle" />
                      </button>
                      {#if assets.diff && assets.diff[file.id]}
                        <span class="ready-to-import">
                          <Icon
                            icon="update"
                            label="Has changed. Import to sync!"
                          />
                        </span>
                      {/if}
                    </span>
                    <span class="filename">
                      {file.path}
                    </span>
                  </li>
                {/each}
              </ol>
            </Section>
          </li>
        {/each}
      </ol>
    {/if}
  </div>
</Section>

<style>
  p {
    color: var(--color-text-subtle);
  }
  .source-container {
    margin-left: 0.5em;
    display: flex;
    flex-direction: column;
    gap: 0.5em;
    margin-top: 0.5em;
  }
  .source-groups {
    --color-border: var(--color-text-subtle);
    height: 20em;
    resize: vertical;
    padding-left: 0.5em;
    padding-right: 0.2em;
  }
  .source-group {
    color: var(--color-text-subtle);
  }
  .source-files {
    margin-left: 0.75em;
  }
  .source-files button {
    margin-right: 0.15em;
  }
  [data-importable='false'] {
    color: var(--color-text);
  }
  .source-group:not([data-group]) h4 {
    font-style: italic;
  }
  .source-group:not([data-ready-to-import='0']) h4 {
    color: var(--color-gold);
  }
  .source-group:not([data-unimportable='0']) h4 {
    color: var(--color-text-error);
  }
  .ready-to-import {
    color: var(--color-gold);
  }
  /* [data-importable='false'] .importable-button {
    color: var(--color-text-error);
  } */

  /* button[data-importable] {
    color: var(--color-text-subtle);
  } */
  /* button[data-importable='false'] {
  } */
</style>
