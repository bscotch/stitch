interface GetAppListResponse {
	applist: {
		apps: { appid: number; name: string }[];
	};
}

/**
 * Blocked by CORS, so requires a server-side proxy.
 */
export async function fetchSteamApps() {
	// See https://partner.steamgames.com/doc/webapi/ISteamApps
	const url = 'https://api.steampowered.com/ISteamApps/GetAppList/v2/';
	try {
		const response = (await fetch(url, {}).then((r) => r.json())) as GetAppListResponse;
		return response.applist.apps;
	} catch (err) {
		console.error(err);
		return [];
	}
}
