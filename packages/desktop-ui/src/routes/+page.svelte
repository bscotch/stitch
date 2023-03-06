<script>
  import Logo from '$lib/assets/stitch-logo-small.webp';
  import { fade } from 'svelte/transition';
</script>

<main transition:fade>
  <figure>
    <div class="background" />
    <img src={Logo} alt="Stitch Logo" />
    <figcaption>Welcome to Stitch!</figcaption>
  </figure>
</main>

<style>
  main {
    width: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 2em;
    height: 100vh;
  }
  figure {
    display: flex;
    position: relative;
    flex-direction: column;
    align-items: center;
    gap: 2em;
  }
  figcaption {
    font-size: 1.5em;
    font-weight: bold;
  }

  .background {
    position: absolute;
    width: 100%;
    aspect-ratio: 1/1;
    animation: breathing 3s ease-in-out infinite normal;
    background-image: linear-gradient(
      45deg,
      var(--color-logo-yellow) 50%,
      var(--color-logo-purple) 50%
    );
    border-radius: 50%;
    filter: blur(4em);
  }

  img,
  figcaption {
    z-index: 1;
  }

  img {
    filter: drop-shadow(0.25em 0.25em 0.5em black);
  }

  figcaption {
    text-shadow: 0.1em 0.1em 0.2em black;
  }

  @keyframes breathing {
    0% {
      transform: scale(1.1);
    }
    50% {
      transform: scale(1.2);
    }
    100% {
      transform: scale(1.1);
    }
  }
</style>
