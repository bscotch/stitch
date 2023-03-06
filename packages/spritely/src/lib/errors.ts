import { AnyFunction, arrayWrapped } from '@bscotch/utility';
import fs from 'fs-extra';
import { error } from './log.js';

export enum ErrorCodes {
  default = 'No error code.',
  sizeMismatch = 'Subimage sizes do not match.',
  noImagesFound = 'No images found.',
}

export class SpritelyError extends Error {
  constructor(
    message: string,
    readonly code = ErrorCodes.default,
    asserter?: AnyFunction,
  ) {
    super(message);
    this.name = 'SpritelyError';
    Error.captureStackTrace(this, asserter || this.constructor);
  }

  /**
   * Check if an error is a VERY loose match to
   * a given Spritely error code or a message.
   * Treats codes and messages as interchangeable,
   * checking each for equality. If more than one
   * test code/message provided, returns true if *any* match.
   */
  static matches(err: any, codeOrMessage: string | string[]) {
    codeOrMessage = arrayWrapped(codeOrMessage);
    return (
      err instanceof SpritelyError &&
      codeOrMessage
        .map((code) => [err.code, err.message].includes(code))
        .filter((x) => x).length > 0
    );
  }
}

/** Throw an error if `claim` is falsey */
export function assert(
  claim: any,
  messageIfFalsey: string,
  code?: ErrorCodes,
): asserts claim {
  if (!claim) {
    throw new SpritelyError(messageIfFalsey, code, assert);
  }
}

export function assertDirectoryExists(directory: string) {
  try {
    assert(fs.existsSync(directory), `${directory} does not exist`);
    assert(
      fs.statSync(directory).isDirectory(),
      `${directory} is not a folder`,
    );
  } catch (err) {
    if (err instanceof SpritelyError) {
      throw err;
    } else {
      error('External error: Could not check for existence of directory.');
      throw err;
    }
  }
}

export function assertNonEmptyArray(
  something: any,
  message = 'Expected non-empty array.',
) {
  assert(Array.isArray(something) && something.length, message);
}

export function assertNumberGreaterThanZero(
  something: any,
  message = 'Expected number greater than zero.',
) {
  assert(typeof something == 'number' && something > 0, message);
}
