<script lang="ts">
	import { base } from '$app/paths';
	import Logo from '$lib/assets/stitch-logo-small.webp';
	import { faGithub } from '@fortawesome/free-brands-svg-icons';
	import Fa from 'svelte-fa';
</script>

<aside id="support-banner">
	💖 Support this project by <a
		href="https://store.steampowered.com/app/1401730?utm_source=stitch-steam-stats&utm_term=tools&utm_content=support-cta"
		>wishlisting Crashlands 2</a
	>! 💖
</aside>

<nav>
	<a href={base || '/'} title="Go home">
		<img src={Logo} alt="Stitch Logo" />
		<span class="name">Stitch</span>
	</a>

	<menu class="reset">
		<li>
			<a href="https://github.com/bscotch/stitch" title="See the Stitch source code">
				<Fa icon={faGithub} size="lg" />
			</a>
		</li>
	</menu>
</nav>

<slot />

<style>
	nav {
		display: flex;
		width: 100%;
		max-width: 50rem;
		justify-content: space-between;
	}
	nav menu a {
		color: var(--color-text);
	}
	nav menu a:hover {
		color: var(--color-link-hover);
	}
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
