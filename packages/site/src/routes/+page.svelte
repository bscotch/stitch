<script>
	import Logo from '$lib/assets/stitch-logo-small.webp';
</script>

<svelte:head>
	<title>Stitch | Butterscotch Shenanigans</title>
	<meta name="description" content="A toolkit for managing GameMaker projects" />
</svelte:head>

<header>
	<figure>
		<div class="background" />
		<img src={Logo} alt="Stitch Logo" />
	</figure>
	<div class="title">
		<h1>Stitch</h1>
		<p>
			A toolkit for managing <a href="https://gamemaker.io/en">GameMaker</a> projects
		</p>
		<p style="font-style:italic">This site is a work in progress.</p>
	</div>
</header>

<main>
	<article>
		<section>
			<h2>Getting Started</h2>
			<p>
				Stitch consists of a bunch of tools to help automate or improve GameMaker workflows. See the <a
					href="https://github.com/bscotch/stitch">GitHub repo</a
				> for details and source code for all Stitch projects.
			</p>
		</section>

		<section>
			<h3>Unified GameMaker Releases Feed</h3>
			<p>
				GameMaker releases come in multiple flavors (LTS, stable, and beta), each with its own
				release notes for both the IDE and the runtime. The Stitch "GameMaker Releases" <a
					href="https://www.npmjs.com/package/@bscotch/gamemaker-releases">npm package</a
				> provides mechinisms to convert all of those into a single, unified feed.
			</p>
			<p>
				Stitch maintains an updated feed and a user-friendly interface for perusing GameMaker
				release notes:
			</p>
			<ul>
				<li>
					<a href="./gamemaker/releases">Browse the unified release notes</a>
				</li>
				<li>
					<a href="./artifacts/gamemaker/releases-summary.json">See the raw feed</a>
				</li>
			</ul>
		</section>
	</article>
</main>

<style>
	article {
		width: 100%;
		max-width: 50rem;
		display: flex;
		flex-direction: column;
		gap: 1em;
		font-size: 1.2rem;
		margin-top: 2rem;
	}
	article section {
		display: flex;
		flex-direction: column;
		gap: 0.5em;
	}
	header {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1.5em;
		font-size: 1.5rem;
		text-align: center;
	}
	.title p {
		font-size: 1.25rem;
	}
	figure {
		display: flex;
		position: relative;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 2em;
		width: 100%;
		max-width: 20rem;
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

	img {
		z-index: 1;
	}

	img {
		filter: drop-shadow(0.25em 0.25em 0.5em black);
	}

	h1 {
		text-shadow: 0.2em 0.2em 0.2em black;
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
