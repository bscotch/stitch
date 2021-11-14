import paths from './paths';
import { assert, StitchError } from './errors';
import fs from './files';
import child_process from 'child_process';
import { oneline } from '@bscotch/utility';
import { difference } from 'lodash';

/**
 * A class for centralizing file system i/o on GMS2
 * projects, so that we can more easily run in read-only
 * mode, attach hooks to file i/o events, etc.
 */
export class Gms2Storage {
  constructor(
    readonly yypAbsolutePath: string,
    readonly isReadOnly = false,
    readonly bypassGitRequirement = false,
  ) {
    if (
      !bypassGitRequirement &&
      process.env.GMS2PDK_DEV != 'true' &&
      !this.workingDirIsClean
    ) {
      throw new StitchError(oneline`
        Working directory for ${paths.basename(
          yypAbsolutePath,
        )} is not clean. Commit or stash your work!
      `);
    }
  }

  get yypDirAbsolute() {
    return paths.dirname(this.yypAbsolutePath);
  }

  get workingDirIsClean() {
    const gitProcessHandle = child_process.spawnSync(`git status`, {
      cwd: this.yypDirAbsolute,
      shell: true,
    });
    if (gitProcessHandle.status != 0) {
      throw new StitchError(gitProcessHandle.stderr.toString());
    } else {
      const isClean = gitProcessHandle.stdout
        .toString()
        .includes('working tree clean');
      return isClean;
    }
  }

  get gitWorkingTreeRoot() {
    const gitProcessHandle = child_process.spawnSync(`git worktree list`, {
      cwd: this.yypDirAbsolute,
      shell: true,
    });
    if (gitProcessHandle.status != 0) {
      throw new StitchError(gitProcessHandle.stderr.toString());
    }
    return gitProcessHandle.stdout.toString().split(/\s+/g)[0];
  }

  toAbsolutePath(pathRelativeToYypDir: string) {
    return paths.join(this.yypDirAbsolute, pathRelativeToYypDir);
  }

  ensureDir(dir: string) {
    if (!this.isReadOnly) {
      fs.ensureDirSync(dir);
    }
  }

  /** Delete all files and folders (recursively) inside this directory. */
  emptyDir(dir: string, includeStartingDir = false) {
    if (!this.isReadOnly) {
      fs.emptyDirSync(dir);
      if (includeStartingDir) {
        fs.removeSync(dir);
      }
    }
  }

  deleteFile(path: string) {
    if (!this.isReadOnly) {
      fs.removeSync(path);
    }
  }

  listFiles(dir: string, recursive?: boolean, allowedExtension?: string[]) {
    if (allowedExtension && allowedExtension.length > 0) {
      return fs.listFilesByExtensionSync(dir, allowedExtension, recursive);
    } else {
      return fs.listFilesSync(dir, recursive);
    }
  }

  listPaths(dir: string, recursive?: boolean) {
    return fs.listPathsSync(dir, recursive);
  }

  /**
   * Copy a file or recursively copy a directory.
   * Files are only overwritten if there is a change.
   */
  copy(from: string, to: string) {
    assert(
      fs.existsSync(from),
      `Cannot copy from ${from}, path does not exist.`,
    );
    if (fs.isFile(from)) {
      if (!fs.existsSync(to) || fs.checksum(from) != fs.checksum(to)) {
        fs.copySync(from, to, { overwrite: true });
      }
      return;
    }
    // If destination doesn't exist we can just copy over.
    if (!fs.existsSync(to) || !fs.listPathsSync(to, true).length) {
      return fs.copySync(from, to, { overwrite: true });
    }
    // Else we need to diff the source and destination,
    // remove any extra files from destination, and write
    // new/updated files.
    const fromFiles = fs
      .listFilesSync(from, true)
      .map((p) => paths.relative(from, p));
    const toFiles = fs
      .listFilesSync(to, true)
      .map((p) => paths.relative(to, p));
    // Delete extra files in destination
    difference(toFiles, fromFiles).forEach((toDelete) =>
      fs.removeSync(paths.join(to, toDelete)),
    );
    // Copy files that have changed or are new
    fromFiles.forEach((fromFileRelative) => {
      const fromAbs = paths.join(from, fromFileRelative);
      const toAbs = paths.join(to, fromFileRelative);
      fs.ensureDirSync(paths.dirname(toAbs));
      if (!fs.existsSync(toAbs) || fs.checksum(toAbs) != fs.checksum(fromAbs)) {
        fs.copySync(fromAbs, toAbs, { overwrite: true });
      }
    });
  }

  exists(path: string) {
    return fs.existsSync(path);
  }

  isFile(path: string) {
    return fs.statSync(path).isFile();
  }

  isDirectory(path: string) {
    return fs.statSync(path).isDirectory();
  }

  copyFile(paths: [source: string, dest: string]): void;
  copyFile(source: string, destinationPath: string): void;
  copyFile(
    sourceOrPaths: string | [source: string, dest: string],
    destinationPath?: string,
  ) {
    if (typeof sourceOrPaths != 'string') {
      [sourceOrPaths, destinationPath] = sourceOrPaths;
    }
    assert(
      fs.existsSync(sourceOrPaths),
      `copyFile: source ${sourceOrPaths} does not exist`,
    );
    if (!this.isReadOnly) {
      fs.ensureDirSync(paths.dirname(destinationPath as string));
      // // Not sure why the file was being deleted first, since
      // // it gets clobered by the copy anyway. The extra file operation
      // // with the delete could trigger unwanted side effects via the
      // // GMS2 file watcher.
      // fs.removeSync(destinationPath as string);
      fs.copyFileSync(sourceOrPaths, destinationPath as string);
    }
  }

  asPosixPath(path: string) {
    return paths.asPosixPath(path);
  }

  /** Write a buffer to file */
  writeBlob(filePath: string, data: string | Buffer): void;
  /** Write a string to file, optionally forcing EOL */
  writeBlob(filePath: string, data: string, eol: '\r\n' | '\n'): void;
  writeBlob(filePath: string, data: string | Buffer, eol?: '\r\n' | '\n') {
    if (!this.isReadOnly) {
      fs.writeFileSync(
        filePath,
        eol && typeof data == 'string' ? data.replace(/\r?\n/gm, eol) : data,
      );
    }
  }

  /** Write data as JSON, defaulting to GMS2.3-style JSON
   * @param {boolean} [plain] Use regular JSON instead of GMS2.3-style.
   */
  writeJson(filePath: string, data: any, plain = false) {
    if (!this.isReadOnly) {
      fs.writeJsonSync(filePath, data, plain);
    }
  }

  readBlob(filePath: string) {
    return fs.readFileSync(filePath);
  }

  readJson(filePath: string) {
    return fs.readJsonSync(filePath);
  }
}
