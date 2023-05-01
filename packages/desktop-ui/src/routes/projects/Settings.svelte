<script lang="ts">
  import { trpc, type GameMakerKnownPathId } from '$lib/api.js';
  import { stitchVersion } from '$lib/util/info.js';
  import Button from '$lib/Button.svelte';
  let dialog: HTMLDialogElement;

  const channelNames = ['beta', 'stable', 'lts'] as const;
  type ChannelName = typeof channelNames[number];

  let groups: {
    id: GameMakerKnownPathId;
    name: string;
    description: string;
    paths: { path: string; channel: ChannelName }[];
  }[] = [];

  async function openPath(path: string) {
    await trpc.openPath.query({ path });
  }

  async function openConfig() {
    await trpc.openPath.query({ name: 'stitchDesktopConfig' });
  }

  async function openIssues() {
    await trpc.openIssues.query({ version: stitchVersion });
  }

  async function loadGameMakerPaths() {
    const knownPaths = await trpc.listGameMakerPaths.query();
    knownPaths.sort((a, b) => a.name.localeCompare(b.name));
    for (const path of knownPaths) {
      let group = groups.find((p) => p.id === path.id);
      if (!group) {
        group = {
          id: path.id,
          name: path.name,
          description: path.description,
          paths: [],
        };
        groups.push(group);
      }
      if (!group.paths.find((p) => p.path === path.path)) {
        group.paths.push({
          path: path.path,
          channel: path.path.match(/\bbeta\b/i)
            ? 'beta'
            : path.path.match(/\blts\b/i)
            ? 'lts'
            : 'stable',
        });
      }
    }
    groups = [...groups];
  }
  loadGameMakerPaths();
</script>

<dialog bind:this={dialog} class="scroller">
  <header>
    <h1>Global Settings &amp; Info</h1>
    <Button icon="close" onClick={() => dialog.close()} />
  </header>
  <section>
    <h2>
      Stitch <span class="stitch-version">
        {stitchVersion}
      </span>
    </h2>
    <p>Have an issue? <a role="button" on:click={openIssues}>Click here.</a></p>
    <p />
    <p>
      Stitch currently stores its settings in a
      <!-- svelte-ignore a11y-click-events-have-key-events -->
      <a role="button" on:click={openConfig}> configuration file </a>.
    </p>
  </section>
  <section>
    <h2>GameMaker Paths</h2>
    <p>
      GameMaker makes use of many files and folders spread across your machine.
      The following are some of the more useful files and folders needed by
      Stitch.
    </p>
    <ul class="reset ">
      {#each groups as group}
        <li class="path-group">
          <h3>{group.name}</h3>
          <p>{group.description}</p>
          <ul class="reset path-list">
            {#each channelNames as channelName}
              {@const path = group.paths.find((p) => p.channel === channelName)}
              {#if path}
                <li class="path" data-channel={path.channel}>
                  <button
                    class="reset"
                    on:click={() => openPath(path.path)}
                    title="Open"
                  >
                    {path.channel}
                  </button>
                </li>
              {/if}
            {/each}
          </ul>
        </li>
      {/each}
    </ul>
  </section>
</dialog>

<Button text="settings" icon="settings" onClick={() => dialog.showModal()} />

<style>
  header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  h2 {
    font-size: 1.3em;
    margin-top: 1em;
  }
  h3 {
    font-size: 1.1em;
  }
  .stitch-version {
    color: var(--color-text-subtle);
    font-weight: 300;
  }
  dialog {
    background-color: var(--color-background);
    color: var(--color-text);
    border-radius: 1em 0 0 1em;
    border: 0;
    margin: 2em;
    padding: 0.5em 1em;
  }
  dialog:modal {
    width: 100%;
    max-width: 30em;
    box-shadow: 0 0 0.5em var(--color-text);
  }
  dialog::backdrop {
    backdrop-filter: blur(0.25em);
    color: rgba(0, 0, 0, 0.5);
  }

  .path-group {
    margin-top: 1em;
  }
  .path-group p {
    margin: 0;
    color: var(--color-text-subtle);
  }

  .path-list {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5em;
  }

  .path button {
    border-width: 0.15em;
    border-style: solid;
    border-radius: 1em;
    color: var(--channel-color);
    border-color: var(--channel-color);
    padding: 0 0.75em;
    font-size: 0.8em;
  }
  .path button:hover {
    background-color: var(--channel-color);
    color: var(--color-background);
  }
  .path[data-channel='stable'] button {
    --channel-color: var(--color-channel-stable);
  }
  .path[data-channel='beta'] button {
    --channel-color: var(--color-channel-beta);
  }
  .path[data-channel='lts'] button {
    --channel-color: var(--color-channel-lts);
  }
</style>
