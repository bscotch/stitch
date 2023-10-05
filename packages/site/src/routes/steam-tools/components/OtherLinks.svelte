<script lang="ts">
	import { config } from '../lib/stores.js';
</script>

<h2>Other Links</h2>
<ul>
	<li>
		<a href={`https://partner.steamgames.com/apps/marketing/${$config.steamId}`}
			>Steam Marketing Portal</a
		>
		<ul>
			<li>
				<a href={`https://partner.steamgames.com/apps/navtrafficstats/${$config.steamId}`}
					>Traffic</a
				>
			</li>
			<li>
				<a href={`https://partner.steamgames.com/apps/utmtrafficstats/${$config.steamId}`}
					>UTM Stats</a
				>
			</li>
			<li>
				<a href={`https://partner.steampowered.com/region/?appID=${$config.steamId}`}>
					Regions & Countries
				</a>
			</li>
			<li>
				<a href="https://partner.steampowered.com/wishlist/daily/">All Games' Wishlists</a>
			</li>
			<li>
				<a href="https://partner.steampowered.com/players.php">All Players</a>
			</li>
		</ul>
	</li>
	<li>
		<a href={`https://steamlikes.co/app/${$config.steamId}#statistics`}>Steam Likes</a>
	</li>
	<li>
		<a href={`https://steamdb.info/app/${$config.steamId}/charts/`}>SteamDB</a>
	</li>
	<li>
		<a href="https://app.sparkpost.com/signals/analytics">SparkPost</a>
	</li>
</ul>
