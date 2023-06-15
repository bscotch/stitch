import vscode from 'vscode';
import { warn } from './log.mjs';

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

export function assert(condition: any, message?: string): asserts condition {
  if (!condition) {
    const err = new Error(message);
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
