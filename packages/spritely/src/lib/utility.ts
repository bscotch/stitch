import crypto from 'crypto';
import {
  wait,
  listFilesByExtensionSync,
  listFoldersSync,
  listPathsSync,
  removeEmptyDirsSync,
} from '@bscotch/utility';
import fs from 'fs-extra';
import { debug, error } from './log.js';

const FILE_FUNCTION_RETRY_WAIT_MILLIS = 100;

/**
 * From Lodash {@link https://github.com/lodash/lodash/blob/master/clamp.js}
 */
export function clamp(number: number, lower: number, upper: number) {
  number = +number;
  lower = +lower;
  upper = +upper;
  lower = lower === lower ? lower : 0;
  upper = upper === upper ? upper : 0;
  if (number === number) {
    number = number <= upper ? number : upper;
    number = number >= lower ? number : lower;
  }
  return number;
}

export function randomHex(bytes = 8): Promise<string> {
  return new Promise((resolve, reject) => {
    crypto.randomBytes(bytes, (err, buffer) => {
      if (err) {
        return reject(err);
      }
      return resolve(buffer.toString('hex'));
    });
  });
}

export function sha256(data: crypto.BinaryLike) {
  return crypto.createHash('sha256').update(data).digest('hex');
}

type Unwrapped<T> = T extends PromiseLike<infer U> ? Unwrapped<U> : T;

function createMessageIfPermanentError(fn: (...args: any[]) => void, err: any) {
  if (err?.code == 'ENOENT') {
    err.message = `File '${err?.path || err?.filename}' not found [${
      err.code
    }] -- ${fn.name} failed.`;
    return err.message;
  }
}

/**
 * Wrap a file function so that it can auto-retry on EBUSY and EPERM errors
 * (these are caused when Dropbox tries to do something on the same files).
 */
function makeRetriable<FileOpFunction extends (...args: any[]) => any>(
  fileOpFunction: FileOpFunction,
) {
  const retriableFunction = async (
    ...args: Parameters<FileOpFunction>
  ): Promise<Unwrapped<ReturnType<FileOpFunction>>> => {
    let fails = 0;
    try {
      return await fileOpFunction(...args);
    } catch (err) {
      fails++;
      const permanentFailureMessage = createMessageIfPermanentError(
        fileOpFunction,
        err,
      );
      if (permanentFailureMessage) {
        debug('Permanent file system error', permanentFailureMessage);
        throw err;
      }
      const failMessage = `${fileOpFunction.name} failed ${fails} times.`;
      if (fails < 10) {
        await wait(FILE_FUNCTION_RETRY_WAIT_MILLIS);
        return retriableFunction(...args);
      }
      error(failMessage);
      throw err;
    }
  };
  return retriableFunction;
}

type WriteFileFn = (file: string, data: string | Buffer) => Promise<void>;
type FileMutateFun = (path: string) => Promise<void>;
type CopyFn = (from: string, to: string) => Promise<void>;
type ExistsFn = (path: string) => Promise<boolean>;

export const fsRetry = {
  emptyDir: makeRetriable<FileMutateFun>(fs.emptyDir),
  ensureDir: makeRetriable<FileMutateFun>(fs.ensureDir),
  listFilesByExtension: makeRetriable(listFilesByExtensionSync),
  listFolders: makeRetriable(listFoldersSync),
  listPaths: makeRetriable(listPathsSync),
  move: makeRetriable<CopyFn>(fs.move),
  pathExists: makeRetriable<ExistsFn>(fs.pathExists),
  remove: makeRetriable<FileMutateFun>(fs.remove),
  removeEmptyDirs: makeRetriable(removeEmptyDirsSync),
  rmdir: makeRetriable<FileMutateFun>(fs.rmdir),
  writeFile: makeRetriable<WriteFileFn>(fs.writeFile),
  stat: makeRetriable<(path: string) => Promise<fs.Stats>>(fs.stat),
  copyFile: makeRetriable<CopyFn>(fs.copyFile),
} as const;
