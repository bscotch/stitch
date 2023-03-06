// import { prettifyErrorTracing, replaceFilePaths } from '@bscotch/validation';

// prettifyErrorTracing({ replaceFilePaths });

export class StitchError extends Error {
  constructor(message: string, asserter?: Function) {
    super(message);
    this.name = 'StitchError';
    Error.captureStackTrace(this, asserter || this.constructor);
  }
}

export class StitchAssertionError extends Error {
  constructor(message: string, asserter?: Function) {
    super(message);
    this.name = 'StitchAssertionError';
    Error.captureStackTrace(this, asserter || this.constructor);
  }
}

export function assert(claim: any, message?: string): asserts claim {
  if (!claim) {
    throw new StitchAssertionError(message || 'Claim is falsey', assert);
  }
}

export function isNumber(value: any): value is number {
  return typeof value == 'number';
}

export function assertIsNumber(
  claim: any,
  message?: string,
): asserts claim is number {
  if (!isNumber(claim)) {
    throw new StitchAssertionError(
      message || `${claim} is not a number`,
      assertIsNumber,
    );
  }
}
