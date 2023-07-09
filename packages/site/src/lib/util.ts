export function toDateIso(date: string | Date) {
	return new Date(date).toISOString();
}

export function toDateLocal(date: string | Date) {
	return new Date(date).toLocaleDateString();
}

export function saveProperty(name: string, value: any) {
	localStorage.setItem(name, JSON.stringify(value));
}

export function loadProperty(name: string) {
	const value = localStorage.getItem(name);
	return value ? JSON.parse(value) : null;
}
