function assert(condition: any, msg?: string): asserts condition {
	if (!condition) {
		throw new Error(msg);
	}
}

export function toDateIso(date: string | Date): string {
	try {
		const asDate = new Date(date);
		assert(!isNaN(asDate.getTime()), 'Invalid date');
		return asDate.toISOString();
	} catch (err) {
		console.error(err);
		console.error(date);
	}
	return '';
}

export function toDateLocal(date: string | Date): string {
	try {
		const asDate = new Date(date);
		assert(!isNaN(asDate.getTime()), 'Invalid date');
		return asDate.toLocaleDateString();
	} catch (err) {
		console.error(err);
		console.error(date);
	}
	return '';
}

export function saveProperty(name: string, value: any) {
	localStorage.setItem(name, JSON.stringify(value));
}

export function loadProperty(name: string) {
	const value = localStorage.getItem(name);
	return value ? JSON.parse(value) : null;
}
