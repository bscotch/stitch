export function getQueryParam<T>(
	name: string,
	searchParams: URLSearchParams,
	parser: (value: string | null) => T
) {
	const value = searchParams.get(name);
	return parser(value);
}

export function updateQueryParam(name: string, value: any, searchParams: URLSearchParams) {
	if (value === undefined) {
		searchParams.delete(name);
	} else {
		// Normalize to a string
		value = value instanceof Date ? value.toISOString() : `${value}`;
		searchParams.set(name, value);
	}
}

export function getQueryParamDate(name: string, searchParams: URLSearchParams) {
	return getQueryParam(name, searchParams, (value) => (value ? new Date(value) : undefined));
}

export function getQueryParamNumber(name: string, searchParams: URLSearchParams) {
	return getQueryParam(name, searchParams, (value) => (value ? Number(value) : undefined));
}
