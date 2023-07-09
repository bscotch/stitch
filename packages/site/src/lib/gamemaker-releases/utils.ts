export function debounce(fn: (...args: any[]) => any, delay: number) {
	let timeoutId: number;
	return function (this: any, ...args: any[]) {
		clearTimeout(timeoutId);
		timeoutId = window.setTimeout(() => fn.apply(this, args), delay);
	};
}
