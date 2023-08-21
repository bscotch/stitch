import vscode from 'vscode';
import { logger, warn } from './log.mjs';

export interface AssertOptions {
  /** If true, this error should be posted to telemetry if enabled */
  send?: boolean;
}

export class StitchVscodeError extends Error {
  constructor(
    message: string,
    public options?: AssertOptions,
    asserter?: Function,
  ) {
    super(message);
    this.name = 'StitchVscodeError';
    Error.captureStackTrace(this, asserter || this.constructor);
  }
}

export function isStitchError(err: any): err is StitchVscodeError {
  return err instanceof StitchVscodeError;
}

export class StitchVscodeUserError extends StitchVscodeError {
  constructor(message: string, options?: AssertOptions, asserter?: Function) {
    super(message, options, asserter);
    this.name = 'StitchVscodeUserError';
  }
}

export class StitchVscodeInternalError extends StitchVscodeError {
  constructor(message: string, options?: AssertOptions, asserter?: Function) {
    super(message, options, asserter);
    this.name = 'StitchVscodeInternalError';
  }
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
  options?: AssertOptions,
): asserts condition {
  if (!condition) {
    const err = new StitchVscodeUserError(
      message,
      options,
      assertInternalClaim,
    );
    // VSCode swallows error messages, so we need to log them
    logger.error(err);
    throw err;
  }
}

export function assertUserClaim(
  condition: any,
  message: string,
  options?: AssertOptions,
): asserts condition {
  if (!condition) {
    const err = new StitchVscodeUserError(message, options, assertUserClaim);
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
    vscode.window.showErrorMessage(message);
    throw new Error(message);
  }
}
