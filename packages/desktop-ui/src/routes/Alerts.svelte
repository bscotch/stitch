<script lang="ts">
  import Icon from '$lib/Icon.svelte';
  import { alerts } from '$lib/store.alerts.js';
  import type { AlertKind, IconId } from '$lib/types.js';
  import { slide } from 'svelte/transition';

  const messageIcons: Record<AlertKind, IconId> = {
    error: 'skull',
    warning: 'notification_important',
    info: 'info',
    success: 'check_circle',
  };

  window.electron?.onNotify(alerts.notify);
  setTimeout(
    () =>
      alerts.notify({
        kind: 'warning',
        text: `NOTICE: Stitch Desktop is being deprecated in favor of <a href="https://tinybs.co/stitch-vscode">Stitch for VSCode</a> (see <a href="https://github.com/bscotch/stitch/issues/138">the announcement</a> for details). Stitch Desktop is no longer maintained.`,
        ttl: 15,
      }),
    5000,
  );
</script>

<aside>
  <h4 class="sr-only">Alerts</h4>
  <ul class="reset scroller">
    {#each $alerts as alert (alert.id)}
      <li
        transition:slide
        data-id={alert.id}
        data-kind={alert.kind}
        class="alert"
      >
        <button class="reset" on:click={() => alerts.dismiss(alert.id)}>
          <Icon icon="close" label="Dismiss message" />
        </button>
        <Icon
          icon={alert.icon || messageIcons[alert.kind]}
          label={alert.kind}
        />
        <span class="message">{@html alert.text}</span>
      </li>
    {/each}
  </ul>
</aside>

<style>
  aside {
    padding-top: 0.25em;
    width: 100%;
    max-width: 100%;
  }
  li[data-kind='error'] {
    --color: rgb(255, 42, 113);
  }
  li[data-kind='warning'] {
    --color: orange;
  }
  li[data-kind='info'] {
    --color: gray;
  }
  li[data-kind='success'] {
    --color: rgb(35, 192, 132);
  }
  li {
    padding: 0.25rem 0.5rem;
    color: var(--color);
    border-top: 0.1em solid currentColor;
    background-color: var(--color-background);
  }
  .message {
    overflow-wrap: break-word;
  }
</style>
