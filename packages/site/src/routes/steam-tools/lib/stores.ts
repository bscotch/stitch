import { derived, writable } from 'svelte/store';
import { daysAgo, isInvalidDate, nextComparisonPeriod, priorComparisonPeriod } from './dates.js';
import {
	steamPageUtmLink,
	steamPlayersLink,
	steamRegionsLink,
	steamTrafficDownloadLink,
	steamTrafficLink,
	steamUtmLink,
	steamWishlistsLink
} from './steamLinks.js';
import type { PeriodDirection } from './util.js';

// Create a svelte store that will hold a JSON object of parameters
// to be stored as the hash in the URL in base64 format.

const crashlandsSteamId = 1401730;

export interface ConfigStore {
	steamId?: number;
	utmSource?: string;
	utmMedium?: string;
	utmCampaign?: string;
	utmTerm?: string;
	utmContent?: string;
	toDate?: Date;
	fromDate?: Date;
	periods?: number;
	periodDirection?: PeriodDirection;
	language?: string;
}

export interface UrlStore {
	nextPeriod?: [Date, Date];
	steamTrafficLink?: string;
	steamTrafficComparisonLink?: string;
	steamUtmLink?: string;
	steamUtmComparisonLink?: string;
	steamWishlistsLink?: string;
	steamWishlistsComparisonLink?: string;
	steamPlayersLink?: string;
	steamPlayersComparisonLink?: string;
	steamTrafficDownloadLink?: string;
	steamTrafficDownloadComparisonLink?: string;
	steamRegionsLink?: string;
	steamRegionsComparisonLink?: string;

	utmLink?: string;
}

function createUrlStore() {
	const { subscribe, update } = writable<ConfigStore>({});

	function overrideFromCurrentUrl() {
		let hash: string | undefined;
		try {
			const url = new URL(window.location.href);
			hash = url.hash.slice(1);
		} catch (err) {
			console.error(err);
		}
		if (hash) {
			const json = JSON.parse(atob(hash));
			update((store) => {
				return cleanStore({
					...store,
					...json
				});
			});
		} else {
			update((store) => cleanStore(store));
		}
	}

	return {
		init() {
			overrideFromCurrentUrl();
		},
		subscribe,
		setField<K extends keyof ConfigStore>(key: K, value: any) {
			update((store) => {
				const newStore = cleanStore({
					...store,
					[key]: value
				});
				updateUrl(newStore);
				return newStore;
			});
		}
	};
}

export const config = createUrlStore();

export const links = derived(
	config,
	($urlStore) => {
		const source = cleanStore({ ...$urlStore });
		const nextPeriod =
			source.periodDirection === 'before'
				? priorComparisonPeriod(source.fromDate, source.toDate, source.periods)
				: nextComparisonPeriod(source.fromDate!, source.toDate!, source.periods);
		const store: UrlStore = {
			nextPeriod,
			steamTrafficLink: steamTrafficLink(source.steamId, source.fromDate, source.toDate),
			steamTrafficComparisonLink: steamTrafficLink(source.steamId, nextPeriod[0], nextPeriod[1]),
			steamUtmLink: steamUtmLink(source.steamId, source.fromDate, source.toDate),
			steamUtmComparisonLink: steamUtmLink(source.steamId, nextPeriod[0], nextPeriod[1]),
			steamWishlistsLink: steamWishlistsLink(source.steamId, source.fromDate, source.toDate),
			steamWishlistsComparisonLink: steamWishlistsLink(
				source.steamId,
				nextPeriod[0],
				nextPeriod[1]
			),
			steamPlayersLink: steamPlayersLink(source.steamId, source.fromDate, source.toDate),
			steamPlayersComparisonLink: steamPlayersLink(source.steamId, nextPeriod[0], nextPeriod[1]),
			utmLink: steamPageUtmLink(
				source.steamId,
				source.utmSource,
				source.utmMedium,
				source.utmCampaign,
				source.utmTerm,
				source.utmContent
			),
			steamTrafficDownloadLink: steamTrafficDownloadLink(
				source.steamId,
				source.fromDate,
				source.toDate
			),
			steamTrafficDownloadComparisonLink: steamTrafficDownloadLink(
				source.steamId,
				nextPeriod[0],
				nextPeriod[1]
			),
			steamRegionsLink: steamRegionsLink(source.steamId, source.fromDate, source.toDate),
			steamRegionsComparisonLink: steamRegionsLink(source.steamId, nextPeriod[0], nextPeriod[1])
		};
		return store;
	},
	{} as UrlStore
);

function updateUrl(store: ConfigStore) {
	try {
		const url = new URL(window.location.href);
		const hash = btoa(JSON.stringify(store));
		url.hash = hash;
		window.history.replaceState({}, '', url.href);
	} catch (err) {
		console.error(err);
	}
}

function cleanStore(values: ConfigStore): Required<ConfigStore> {
	for (const key of Object.keys(values)) {
		if ([undefined, null, ''].includes(values[key as keyof ConfigStore] as any)) {
			delete values[key as keyof ConfigStore];
		}
	}

	// Fix the steamId
	values.steamId = Number(values.steamId) || crashlandsSteamId;

	// Fix the date range
	values.toDate =
		typeof values.toDate === 'string'
			? new Date(values.toDate)
			: values.toDate instanceof Date
				? values.toDate
				: new Date();
	if (isInvalidDate(values.toDate)) {
		values.toDate = new Date();
	}
	values.fromDate =
		typeof values.fromDate === 'string'
			? new Date(values.fromDate)
			: values.fromDate instanceof Date
				? values.fromDate
				: daysAgo(14, values.toDate);
	if (isInvalidDate(values.fromDate)) {
		values.fromDate = daysAgo(14, values.toDate);
	}

	// Fix the comparison period info
	values.periods = Math.max(Number(values.periods) || 1, 1);
	values.periodDirection = ['before', 'after'].includes(values.periodDirection as any)
		? values.periodDirection
		: 'before';

	return values as Required<ConfigStore>;
}
