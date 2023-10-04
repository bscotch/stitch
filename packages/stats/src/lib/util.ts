export function debounce(fn: Function, delay: number) {
	let timer: any = null;
	return function () {
		if (timer) {
			clearTimeout(timer);
		}
		timer = setTimeout(fn, delay);
	};
}

export type PeriodDirection = 'before' | 'after';
