import { logger, showErrorMessage, warn } from './log.mjs';

export class StitchVscodeError extends Error {
  constructor(message: string, asserter?: Function) {
    super(message);
    this.name = 'StitchVscodeError';
    Error.captureStackTrace(this, asserter || this.constructor);
  }
}

export function isStitchError(err: any): err is StitchVscodeError {
  return err instanceof StitchVscodeError;
}

export class StitchVscodeUserError extends StitchVscodeError {
  constructor(message: string, asserter?: Function) {
    super(message, asserter);
    this.name = 'StitchVscodeUserError';
  }
}

export class StitchVscodeInternalError extends StitchVscodeError {
  constructor(message: string, asserter?: Function) {
    super(message, asserter);
    this.name = 'StitchVscodeInternalError';
  }
}

export function throwUserError(message: string): never {
  throw new StitchVscodeUserError(message, throwUserError);
}

/**
 * Call a function with its arguments. If
 * it throws an error, log it with console.log
 * and rethrow. Useful for debugging since
 * VSCode swallows error messages.
 */
export function logThrown<A extends any[], T extends (...args: A) => any>(
  fn: T,
  ...args: A
): ReturnType<T> {
  try {
    return fn(...args);
  } catch (err) {
    warn(err);
    throw err;
  }
}

export function swallowThrown<A extends any[], T extends (...args: A) => any>(
  fn: T,
  ...args: A
): ReturnType<T> | undefined {
  try {
    return fn(...args);
  } catch (err) {
    warn(err);
  }
  return;
}

export function assertInternalClaim(
  condition: any,
  message: string,
): asserts condition {
  if (!condition) {
    const err = new StitchVscodeUserError(message, assertInternalClaim);
    // VSCode swallows error messages, so we need to log them
    logger.error(err);
    throw err;
  }
}

export function assertUserClaim(
  condition: any,
  message: string,
): asserts condition {
  if (!condition) {
    const err = new StitchVscodeUserError(message, assertUserClaim);
    // VSCode swallows error messages, so we need to log them
    warn(err);
    throw err;
  }
}

/**
 * Assert a claim and, if it fails, both throw an error
 * and show the error in vscode.
 */
export function assertLoudly(
  condition: any,
  message: string,
): asserts condition {
  if (!condition) {
    showErrorMessage(message);
    throw new Error(message);
  }
}
