import { assert } from './errors.js';

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

export function nextComparisonPeriod(initialFrom: Date, initialTo: Date, periods = 1) {
	assert(periods > 0 && periods < 100, 'Invalid number of periods');
	for (const [from, to] of nextComparisonPeriods(initialFrom, initialTo)) {
		if (--periods === 0) return [from, to] as const;
	}
}

export function priorComparisonPeriod(initialFrom: Date, initialTo: Date, periods = 1) {
	assert(periods > 0 && periods < 100, 'Invalid number of periods');
	for (const [from, to] of priorComparisonPeriods(initialFrom, initialTo)) {
		if (--periods === 0) return [from, to] as const;
	}
}

/**
 * Given an initial start and end date, generate the next start and end date
 * that doesn't overlap with the initial range and that uses the same days of the week
 * as the initial range.
 */
export function* nextComparisonPeriods(initialFrom: Date, initialTo: Date) {
	const startWeekDay = initialFrom.getDay();
	const endWeekDay = initialTo.getDay();
	const daysBetween = (initialTo.getTime() - initialFrom.getTime()) / (1000 * 60 * 60 * 24);
	let currentTo = initialTo;
	while (true) {
		// Get the next start date, which will be the first day that has startWeekDay as its day of the week, after the current end date
		const nextFrom = new Date(currentTo.getTime());
		nextFrom.setDate(nextFrom.getDate() + 1);
		while (nextFrom.getDay() !== startWeekDay) {
			nextFrom.setDate(nextFrom.getDate() + 1);
		}
		// Get the next end date, which will be daysBetween days after the next start date
		const nextTo = new Date(nextFrom.getTime());
		nextTo.setDate(nextTo.getDate() + daysBetween);
		assert(
			nextTo.getDay() === endWeekDay,
			'Somehow ended up with the wrong weekday for the end date'
		);
		yield [nextFrom, nextTo] as const;
		currentTo = nextTo;
	}
}

export function* priorComparisonPeriods(initialFrom: Date, initialTo: Date) {
	const startWeekDay = initialFrom.getDay();
	const endWeekDay = initialTo.getDay();
	const daysBetween = (initialTo.getTime() - initialFrom.getTime()) / (1000 * 60 * 60 * 24);
	let currentFrom = initialFrom;
	while (true) {
		// Get the next end date, which will be the first day that has endWeekDay as its day of the week, before the current start date
		const nextTo = new Date(currentFrom.getTime());
		nextTo.setDate(nextTo.getDate() - 1);
		while (nextTo.getDay() !== endWeekDay) {
			nextTo.setDate(nextTo.getDate() - 1);
		}
		// Get the next start date, which will be daysBetween days before the next end date
		const nextFrom = new Date(nextTo.getTime());
		nextFrom.setDate(nextFrom.getDate() - daysBetween);
		assert(
			nextFrom.getDay() === startWeekDay,
			'Somehow ended up with the wrong weekday for the start date'
		);
		yield [nextFrom, nextTo] as const;
		currentFrom = nextFrom;
	}
}
