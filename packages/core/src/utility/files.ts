/**
 * @file GameMaker files and file-system needs have some specificies that
 * aren't dealth with by native fs or popular library fs-extra. This module
 * should be used for any file system operations, so that only those methods
 * that we know won't create problems will be exported and useable (and any
 * methods that would create problems can be rewritten).
 */

import { Pathy } from '@bscotch/pathy';
import {
  listFilesByExtensionSync,
  listFilesSync,
  listFoldersSync,
  listPathsSync,
  md5,
} from '@bscotch/utility';
import fs from 'fs-extra';
import { assert } from './errors.js';
import path from './paths.js';
import crypto from 'crypto';

/** Return `true` if the path exists and is a directory */
function isDirSync(filePath: string) {
  if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
    return true;
  }
  return false;
}

function isFileSync(filePath: string) {
  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    return true;
  }
  return false;
}

function checksum(filePath: string) {
  assert(
    isFileSync(filePath),
    `${filePath} is not a file; cannot compute checksum.`,
  );
  return md5(fs.readFileSync(filePath), 'hex');
}

function ensureDirSync(dir: string) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  assert(fs.statSync(dir).isDirectory(), `Path ${dir} is not a directory.`);
}

/** Write file while ensuring the parent directories exist. */
function writeFileSync(filePath: string, stuff: string | Buffer) {
  assert(
    !isDirSync(filePath),
    `${filePath} is a directory; it cannot have a file written over it`,
  );
  ensureDirSync(path.dirname(filePath));
  fs.writeFileSync(filePath, stuff);
}

function copyFileSync(source: string, targetPath: string) {
  ensureDirSync(path.dirname(targetPath));
  assert(
    !isDirSync(targetPath),
    `${targetPath} is a directory; it cannot have a file written over it`,
  );
  fs.copyFileSync(source, targetPath);
}

export interface FileDifferenceFile {
  path: string | Pathy;
  checksum?: string;
}
export type FileDifferenceType = 'added' | 'deleted' | 'modified';
export interface FileDifference {
  areSame: boolean;
  change?: FileDifferenceType;
}

/**
 * Compare two files and return a high-level description of the difference.
 * Checksums are computed if not provided. Files do not have to exist.
 *
 * Diff interpretation is left compared to right. For example, if `left` exists
 * and `right` does not, the `change` type is `"deleted"`.
 */
export async function compareFilesByChecksum(
  left: FileDifferenceFile,
  right: FileDifferenceFile,
): Promise<FileDifference> {
  const exists = await Promise.all([
    fs.pathExists(left.path.toString()),
    fs.pathExists(right.path.toString()),
  ]);
  if (!exists[0] && !exists[1]) {
    return { areSame: true };
  }
  if (!exists[0] && exists[1]) {
    return { areSame: false, change: 'added' };
  }
  if (exists[0] && !exists[1]) {
    return { areSame: false, change: 'deleted' };
  }
  const checksums = await Promise.all([
    left.checksum || fileChecksum(left.path.toString()),
    right.checksum || fileChecksum(right.path.toString()),
  ]);
  if (checksums[0] === checksums[1]) {
    return { areSame: true };
  }
  return { areSame: false, change: 'modified' };
}

export function fileChecksum(path: Pathy | string): Promise<string> {
  return new Promise(function (resolve, reject) {
    // crypto.createHash('sha1');
    // crypto.createHash('sha256');
    const hash = crypto.createHash('md5');
    const input = fs.createReadStream(path.toString());

    input.on('error', reject);

    input.on('data', function (chunk) {
      hash.update(chunk);
    });

    input.on('close', function () {
      resolve(hash.digest('base64'));
    });
  });
}

export default {
  // Override with custom methods, and add new ones
  // Note: If adding more methods here, either directly from fs(-extra)
  // or as custom method, ensure that it will work with wonky
  // GameMaker file formats (e.g. yy and yyp files are JSON-like, but
  // have trailing commas and include BigInt values)
  statSync: fs.statSync,
  fileChecksum,
  existsSync: fs.existsSync,
  removeSync: fs.removeSync,
  ensureDirSync,
  copyFileSync,
  checksum,
  mkdirSync: fs.mkdirSync,
  copySync: fs.copySync,
  emptyDirSync: fs.emptyDirSync,
  readFileSync: fs.readFileSync,
  writeFileSync,
  listPathsSync,
  listFoldersSync,
  listFilesSync,
  listFilesByExtensionSync,
  isFileSync,
  moveSync: fs.moveSync,
};
