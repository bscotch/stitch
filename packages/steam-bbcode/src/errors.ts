export class SteamBbCodeError extends Error {
  constructor(message: string, asserter?: Function) {
    super(message);
    this.name = 'SteamBbCode';
    Error.captureStackTrace?.(this, asserter || this.constructor);
  }
}

export function assert(claim: any, message: string): asserts claim {
  if (!claim) {
    throw new SteamBbCodeError(message, assert);
  }
}
