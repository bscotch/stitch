import 'source-map-support/register';

export class StitchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StitchError';
    Error.captureStackTrace(this, this.constructor);
  }
}

export class StitchAssertionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StitchAssertionError';
    Error.captureStackTrace(this, this.constructor);
  }
}

export function assert(claim: any, message?: string): asserts claim {
  if (!claim) {
    throw new StitchAssertionError(message || 'Claim is falsey');
  }
}
