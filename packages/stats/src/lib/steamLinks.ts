import { dateToDateInputString } from './dates.js';

function steamDate(date: Date) {
	const month = `${date.getMonth() + 1}`.padStart(2, '0');
	const day = `${date.getDate()}`.padStart(2, '0');
	const year = `${date.getFullYear()}`;
	return `${month}%2F${day}%2F${year}`;
}

export function steamTrafficLink(steamId: number, from: Date, to: Date) {
	return `https://partner.steamgames.com/apps/navtrafficstats/${steamId}?attribution_filter=all&preset_date_range=custom&start_date=${steamDate(
		from
	)}&end_date=${steamDate(to)}`;
}

export function steamUtmLink(steamId: number, from: Date, to: Date) {
	return `https://partner.steamgames.com/apps/utmtrafficstats/${steamId}?preset_date_range=custom&start_date=${steamDate(
		from
	)}&end_date=${steamDate(to)}`;
}

export function steamWishlistsLink(steamId: number, from: Date, to: Date) {
	return `https://partner.steampowered.com/app/wishlist/${steamId}/?dateStart=${dateToDateInputString(
		from
	)}&dateEnd=${dateToDateInputString(to)}`;
}

export function steamPlayersLink(steamId: number, from: Date, to: Date) {
	return `https://partner.steampowered.com/app/players/${steamId}/?dateStart=${dateToDateInputString(
		from
	)}&dateEnd=${dateToDateInputString(to)}`;
}
