<script lang="ts">
	import Logo from '$lib/assets/stitch-logo-small.webp';
</script>

<nav>
	<a href="/" title="Go home">
		<img src={Logo} alt="SvelteKit" />
		<span class="name">Stitch</span>
	</a>
</nav>

<slot />

<style>
	nav a {
		display: flex;
		align-items: center;
		text-decoration: none;
	}
	nav a:hover {
		text-decoration: underline;
	}
	nav a .name {
		font-weight: bold;
		color: var(--color-text);
		padding-inline: 0.5rem;
	}
	img {
		width: 2rem;
		height: auto;
		display: inline-block;
	}
</style>
