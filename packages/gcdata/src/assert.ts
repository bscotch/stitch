export class GcdataError extends Error {
  constructor(message: string, asserter?: Function) {
    super(message);
    this.name = 'GcdataError';
    Error.captureStackTrace(this, asserter || this.constructor);
  }
}

export function assert(claim: any, message: string): asserts claim {
  if (!claim) {
    throw new GcdataError(message, assert);
  }
}
