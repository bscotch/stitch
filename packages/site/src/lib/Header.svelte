<script lang="ts">
	import { base } from '$app/paths';
	import Logo from '$lib/assets/stitch-logo-small.webp';
	import { faGithub } from '@fortawesome/free-brands-svg-icons';
	import Fa from 'svelte-fa';
</script>

<aside>
	<span class="heart outer">💖</span> Support this project by
	<span style="display:inline-block;">
		<span class="heart inner">💖</span>
		<a
			href="https://store.steampowered.com/app/1401730?utm_source=stitch-site&utm_term=tools&utm_content=support-cta"
			>wishlisting Crashlands 2</a
		> <span class="heart">💖</span></span
	>
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

<style>
	nav {
		display: flex;
		width: 100%;
		max-width: var(--header-max-width);
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
	aside a {
		/* Prevent it from breaking */
		text-decoration: none;
		color: yellow;
		border-bottom: 1px dotted yellow;
		padding-bottom: 0.1em;
	}
	aside {
		text-align: center;
		padding-block: 1em;
	}
	.heart.inner {
		display: none;
	}
	/* Below 500px show inner but not outer heart */
	@media (max-width: 500px) {
		.heart.outer {
			display: none;
		}
		.heart.inner {
			display: inline;
		}
	}
</style>
