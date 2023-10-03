export class StatsError extends Error {
	constructor(message: string, asserter?: Function) {
		super(message);
		this.name = 'StatsError';
		Error.captureStackTrace(this, asserter || this.constructor);
	}
}

export function assert(claim: any, message: string): asserts claim {
	if (!claim) {
		throw new StatsError(message, assert);
	}
}
