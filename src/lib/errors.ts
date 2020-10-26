
export class StitchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StitchError";
    Error.captureStackTrace(this, this.constructor);
  }
}

class StitchAssertionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StitchAssertionError";
    Error.captureStackTrace(this, this.constructor);
  }
}

export function assert(claim: any, message: string) {
  if (!claim) {
    throw new StitchAssertionError(message);
  }
}