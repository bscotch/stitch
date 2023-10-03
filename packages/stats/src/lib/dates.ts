export function daysAgo(days: number, date = new Date()) {
	const result = new Date(date.getTime());
	result.setDate(result.getDate() - days);
	return result;
}

export function dateToDateInputString(date: Date | undefined) {
	if (!date) return undefined;
	return `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date
		.getDate()
		.toString()
		.padStart(2, '0')}`;
}
