<script>
  import { page } from '$app/stores';
  import Logo from '$lib/assets/stitch-logo-small.webp';
</script>

<section>
  <h1>Error {$page.status}</h1>
  <p>{$page.error.message}</p>

  <img src={Logo} alt="Stitch Logo" />
</section>

<style>
  section {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1em;
    padding-inline-start: 2em;
  }
  img {
    width: 100%;
    max-width: 15em;
  }
  h1 {
    color: var(--color-text-danger);
    font-size: 2em;
  }
</style>
