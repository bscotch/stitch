<script>
  import Logo from '$lib/assets/stitch-logo-small.webp';
  import { fade } from 'svelte/transition';
</script>

<main transition:fade>
  <article>
    <header>
      <figure>
        <div class="background" />
        <img src={Logo} alt="Stitch Logo" />
      </figure>
      <h1>Stitch</h1>
    </header>
    <p>
      A toolkit for managing <a href="https://gamemaker.io/en">GameMaker</a> projects
    </p>
    <footer> by <a href="https://www.bscotch.net">Butterscotch Shenanigans</a>
    </footer>
  </article>

</main>

<style>
  main {
    width: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 3em;
  }
  figure {
    display: flex;
    position: relative;
    flex-direction: column;
    align-items: center;
    gap: 2em;
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

  img{
    z-index: 1;
  }

  img {
    filter: drop-shadow(0.25em 0.25em 0.5em black);
  }

  h1 {
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
