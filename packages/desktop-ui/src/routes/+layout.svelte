<script lang="ts">
  import { beforeNavigate, goto } from '$app/navigation';
  import Logo from '$lib/assets/stitch-logo-small.webp';
  import { initialize } from '$lib/init.js';
  import { wait } from '$lib/util/wait.js';
  import { waitFor } from 'xstate/lib/waitFor.js';
  import Alerts from './Alerts.svelte';

  beforeNavigate((nav) => {
    if (nav.to && nav.to?.url.host != nav.from?.url.host) {
      // Then we're leaving the site. Capture and
      // then re-navigate using a new tab (so that
      // Electron can capture the navigation).
      nav.cancel();
      window.open(nav.to.url.href, '_blank');
    }
  });

  async function runStartSequence() {
    const initActor = initialize();
    initActor.send('connect');
    // To prevent a flicker of the start screen,
    // have a minimum wait time.
    await wait(1000);
    await waitFor(initActor, (state) => state.matches('ready'));
    // Change to the projects page
    await goto('/projects');
  }

  runStartSequence();
</script>

<svelte:head>
  <title>Stitch</title>
  <link rel="icon" href={Logo} />
</svelte:head>

<section>
  <slot />
  <footer>
    <Alerts />
  </footer>
</section>

<style>
  section {
    position: relative;
    display: flex;
    flex-direction: column;
    min-height: 100vh;
  }
  footer {
    position: absolute;
    bottom: 0;
    width: 100vw;
  }
</style>
