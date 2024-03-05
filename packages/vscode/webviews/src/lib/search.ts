export interface SearchProps {
	caseSensitive?: boolean;
	regex?: boolean;
	query?: string;
	wholeWord?: boolean;
}

export type Position = [start: number, end: number];
export interface MarkOptions {
	/**
	 * Attributes to add to the marking tag, as a string
	 * @default 'class="search-result"'
	 */
	attributes?: string;
	/**
	 * The name of the tag to use for marking.
	 * @default 'mark'
	 */
	tag?: string;
}
export interface SearchOptions {
	ignoreCase?: boolean;
	asRegex?: boolean;
	asWholeWord?: boolean;
}

/**
 * Wrapper function combining {@link mark} and {@link search}.
 */
export function markSearchResults(
	source: string,
	pattern: string | undefined,
	options?: SearchOptions & MarkOptions
): string {
	return mark(source, search(source, pattern, options), options);
}

/**
 * Given a collection of positions within a source string,
 * get a new string with prefix and postfix strings wrapped
 * around each position.
 *
 * @param positions An array of non-overlapping positions within the source string.
 *
 * @example mark('hello', [[0,5]], '<mark>', '</mark>') // => '<mark>hello</mark>'
 * */
export function mark(source: string, positions: Position[], options?: MarkOptions): string {
	if (!positions.length) return source;
	// Make sure positions are in ascending order and non-overlapping.
	positions = [...positions].sort((a, b) => a[0] - b[0]);
	assert(
		positions.every((p, i) => {
			if (i === 0) return true;
			const isAfterPrevious = p[0] >= positions[i - 1][1];
			const isSameAsPrevious = p[0] === positions[i - 1][0] && p[1] === positions[i - 1][1];
			return isAfterPrevious && !isSameAsPrevious;
		}),
		'Positions must be non-overlapping and unique'
	);

	const tag = options?.tag?.replace(/^<(.*?)>$/, '$1') || 'mark';
	const attributes = options?.attributes ?? 'class="search-result"';

	// As functions so we can do dynamic things later if needed
	// (e.g. for unique ids)
	const prefix = () => `<${tag} ${attributes}>`;
	const postfix = () => `</${tag}>`;

	let string = '';
	let positionIdx = 0;

	let i = 0;
	for (; i < source.length && positionIdx < positions.length; i++) {
		const [start, end] = positions[positionIdx];
		if (i < start) {
			string += source[i];
		} else if (i === start) {
			string += prefix() + source[i];
		} else if (i > start && i < end) {
			string += source[i];
		} else if (i === end) {
			string += postfix() + source[i];
			positionIdx++;
		}
	}
	string += source.slice(i);
	return string;
}

/**
 * Given a source string and a search pattern, return an array of
 * match positions within the source string.
 *
 * If the string is formatted as a JavaScript-style regex (e.g. `/pattern/flags`) it will be treated as such. Otherwise the string will be checked for *exact* matches to the pattern.
 *
 * The search pattern will always be treated as global (i.e. all matches will be returned).
 */
export function search(
	source: string,
	pattern: string | undefined,
	options?: SearchOptions
): Position[] {
	const matches: Position[] = [];
	if (!source || !pattern) return matches;
	assertIsString(source, 'Expected source to be a string');
	assertIsString(pattern, 'Expected pattern to be a string');

	let searchPattern: string | RegExp = pattern;
	if (options?.asRegex) {
		searchPattern = new RegExp(pattern, `g${options?.ignoreCase ? 'i' : ''}`);
	} else if (options?.asWholeWord) {
		searchPattern = new RegExp(
			`\\b${escapeRegexSpecialChars(pattern)}\\b`,
			`g${options?.ignoreCase ? 'i' : ''}`
		);
	}

	if (typeof searchPattern === 'string') {
		// Find the indices of each instance of the pattern.
		source = options?.ignoreCase ? source.toLowerCase() : source;
		pattern = options?.ignoreCase ? pattern.toLowerCase() : pattern;
		let index = -1;
		while ((index = source.indexOf(pattern, index + 1)) !== -1) {
			matches.push([index, index + pattern.length]);
		}
		return matches;
	} else {
		let match: RegExpExecArray | null;
		while ((match = searchPattern.exec(source)) !== null) {
			matches.push([match.index, match.index + match[0].length]);
			searchPattern.lastIndex = match.index + match[0].length;
		}
		return matches;
	}
}

export function escapeRegexSpecialChars(str: string): string {
	return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export class SearchMarkError extends Error {
	constructor(message: string, asserter?: Function) {
		super(message);
		this.name = 'SearchMarkError';
		Error.captureStackTrace?.(this, asserter || this.constructor);
	}
}

export function assert(claim: any, message: string): asserts claim {
	if (!claim) {
		throw new SearchMarkError(message, assert);
	}
}

function assertIsString(value: any, message?: string): asserts value is string {
	assert(typeof value === 'string', message || `Expected a string, but got ${typeof value}`);
}
