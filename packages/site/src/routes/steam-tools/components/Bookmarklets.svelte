<script lang="ts">
	import { steamLikesBookmarklet } from '../lib/steamLikesBookmarklet.js';
	import { steamRegionsBookmarklet } from '../lib/steamRegionsBookmarklet.js';
	import { steamTrafficBookmarklet } from '../lib/steamTrafficBookmarklet.js';
	import { steamWishlistActionsBookmarklet } from '../lib/steamWishlistActionsBookmarklet.js';
</script>

<section>
	<h3>Bookmarklets</h3>

	<p>
		Install bookmarklets by dragging the link into your bookmarks toolbar. Then, when you're on a
		site that has a matching bookmarklet, just click the bookmarklet to run it!
	</p>

	<ul>
		<li>
			<a href={steamWishlistActionsBookmarklet}>Stitch:SteamWishlistActions</a>: Adds copy buttons
			to Daily and Total Wishlist Action charts.
		</li>
		<li>
			<a href={steamTrafficBookmarklet}>Stitch:SteamTraffic</a>: Adds copy buttons to the Steam
			Traffic Breakdown chart.
		</li>
		<li>
			<a href={steamLikesBookmarklet}>Stitch:SteamLikes</a>: Adds copy buttons to the Steam Likes
			plot.
		</li>
		<li>
			<a href={steamRegionsBookmarklet}>Stitch:SteamRegions</a>: Adds copy buttons to the Steam
			Regions page.
		</li>
	</ul>
</section>
