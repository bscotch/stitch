export class StitchImportError extends Error {
  constructor(message: string, asserter?: Function) {
    super(message);
    this.name = 'StitchImportError';
    Error.captureStackTrace(this, asserter || this.constructor);
  }
}

export function assertStitchImportClaim(
  claim: any,
  message: string,
): asserts claim {
  if (!claim) {
    throw new StitchImportError(message, assertStitchImportClaim);
  }
}
