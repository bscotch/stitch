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

export function sortedObject<T extends Record<string,any>>(obj:T):T {
	const keys = Object.keys(obj).sort() as (keyof T)[];
	const newObj = {} as T;
	for (const key of keys) {
		newObj[key] = obj[key];
	}
	return newObj;
}