import fs from '../../lib/files';

class Gms2PipelineCliAssertionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'Gms2PipelineCliAssertionError';
    Error.captureStackTrace(this, this.constructor);
  }
}

function assert(claim: any, message: string) {
  if (!claim) {
    throw new Gms2PipelineCliAssertionError(message);
  }
}

function getTruthyArgs(args: string[]) {
  return args.filter((arg) => arg);
}

function assertMutualExclusion(args: string[]) {
  const truthyArgs = getTruthyArgs(args);
  assert(
    truthyArgs.length <= 1,
    `Cannot accept these mutually exclusive inputs: ${truthyArgs}`,
  );
}

function assertAtLeastOneTruthy(args: string[]) {
  const truthyArgs = getTruthyArgs(args);
  assert(
    truthyArgs.length >= 1,
    `Must have one non-empty inputs. Current non-empty inputs are: ${truthyArgs}`,
  );
}

function assertPathExists(...args: any[]) {
  for (const arg of args) {
    assert(fs.existsSync(arg), `The given path does not exists at: ${arg}`);
  }
}

export default {
  assertMutualExclusion,
  assertAtLeastOneTruthy,
  assertPathExists,
  Gms2PipelineCliAssertionError,
  assert,
  getTruthyArgs,
};
