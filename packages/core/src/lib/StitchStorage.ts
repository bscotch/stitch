import { pathy } from '@bscotch/pathy';
import { oneline } from '@bscotch/utility';
import { Yy } from '@bscotch/yy';
import { ok } from 'assert';
import child_process from 'child_process';
import { difference } from 'lodash-es';
import { z } from 'zod';
import { assert, StitchError } from '../utility/errors.js';
import fs from '../utility/files.js';
import { debug } from '../utility/log.js';
import paths from '../utility/paths.js';
import type { Gms2ResourceType } from './components/Gms2ResourceArray.js';

/**
 * A class for centralizing file system i/o on GMS2
 * projects, so that we can more easily run in read-only
 * mode, attach hooks to file i/o events, etc.
 */
export class StitchStorage {
  constructor(
    protected _yypPathAbsolute: string,
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
          _yypPathAbsolute,
        )} is not clean. Commit or stash your work!
      `);
    }
  }

  get yypPathAbsolute() {
    return this._yypPathAbsolute;
  }

  renameYypFile(newName: string) {
    ok(!this.isReadOnly, 'Cannot rename YYP file in read-only mode.');
    newName = newName.replace(/\.yyp$/, '');
    ok(
      !newName.match(/[/\\]/),
      'New name cannot contain slashes! It must be a valid filename.',
    );
    const oldPath = this.yypPathAbsolute;
    this._yypPathAbsolute = paths.join(this.yypDirAbsolute, newName + '.yyp');
    fs.moveSync(oldPath, this.yypPathAbsolute);
    return this._yypPathAbsolute;
  }

  get yypDirAbsolute() {
    return paths.dirname(this.yypPathAbsolute);
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

  ensureDirSync(dir: string) {
    if (!this.isReadOnly) {
      fs.ensureDirSync(dir);
    }
  }

  /** Delete all files and folders (recursively) inside this directory. */
  emptyDirSync(dir: string, includeStartingDir = false) {
    if (!this.isReadOnly) {
      if (!fs.existsSync(dir)) {
        return;
      }
      fs.emptyDirSync(dir);
      if (includeStartingDir) {
        fs.removeSync(dir);
      }
    }
  }

  deleteFileSync(path: string) {
    if (!this.isReadOnly) {
      fs.removeSync(path);
    }
  }

  listFilesSync(dir: string, recursive?: boolean, allowedExtension?: string[]) {
    if (allowedExtension && allowedExtension.length > 0) {
      return fs.listFilesByExtensionSync(dir, allowedExtension, recursive);
    } else {
      return fs.listFilesSync(dir, recursive);
    }
  }

  listPathsSync(dir: string, recursive?: boolean) {
    return fs.listPathsSync(dir, recursive);
  }

  /**
   * Copy a file or recursively copy a directory.
   * Files are only overwritten if there is a change.
   */
  copySync(from: string, to: string, options?: { sparse?: boolean }) {
    assert(
      fs.existsSync(from),
      `Cannot copy from ${from}, path does not exist.`,
    );
    if (fs.isFileSync(from)) {
      if (!fs.existsSync(to) || fs.checksum(from) != fs.checksum(to)) {
        fs.copySync(from, to, { overwrite: true });
      }
      return;
    }
    // If destination doesn't exist we can just copy over.
    if (!fs.existsSync(to) || !fs.listPathsSync(to, true).length) {
      fs.mkdirSync(paths.dirname(to), { recursive: true });
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
    if (!options?.sparse) {
      // Delete extra files in destination
      difference(toFiles, fromFiles).forEach((toDelete) =>
        fs.removeSync(paths.join(to, toDelete)),
      );
    }
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

  existsSync(path: string) {
    return fs.existsSync(path);
  }

  isFileSync(path: string) {
    return fs.statSync(path).isFile();
  }

  isDirectorySync(path: string) {
    return fs.statSync(path).isDirectory();
  }

  copyFileSync(paths: [source: string, dest: string]): void;
  copyFileSync(source: string, destinationPath: string): void;
  copyFileSync(
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
      // // it gets clobbered by the copy anyway. The extra file operation
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
  writeBlobSync(filePath: string, data: string | Buffer): void;
  /** Write a string to file, optionally forcing EOL */
  writeBlobSync(filePath: string, data: string, eol: '\r\n' | '\n'): void;
  writeBlobSync(filePath: string, data: string | Buffer, eol?: '\r\n' | '\n') {
    if (!this.isReadOnly) {
      fs.writeFileSync(
        filePath,
        eol && typeof data == 'string' ? data.replace(/\r?\n/gm, eol) : data,
      );
    }
  }

  /**
   * Write data as plain JSON
   */
  writeJsonSync(filePath: string, data: any, schema?: z.ZodSchema) {
    if (!this.isReadOnly) {
      fs.writeFileSync(
        filePath,
        JSON.stringify(schema ? schema.parse(data) : data, null, 2),
      );
    }
  }

  /**
   * @returns true if the file was written, false if not (e.g. read-only mode or no change)
   */
  writeYySync(
    filePath: string,
    data: any,
    type?: Gms2ResourceType | 'project',
  ): boolean {
    if (!this.isReadOnly) {
      if (Yy.writeSync(filePath, data, type)) {
        debug(`Wrote file ${paths.basename(filePath)}`);
        return true;
      }
    }
    return false;
  }

  async writeYy(
    filePath: string,
    data: any,
    type?: Gms2ResourceType | 'project',
  ) {
    if (!this.isReadOnly) {
      if (await Yy.write(filePath, data, type)) {
        debug(`Wrote file ${paths.basename(filePath)}`);
      }
    }
  }

  readBlobSync(filePath: string) {
    return fs.readFileSync(filePath);
  }

  readTextSync(filePath: string) {
    return fs.readFileSync(filePath, 'utf8');
  }

  readJsonSync(filePath: string, schema?: z.ZodSchema) {
    return Yy.readSync(filePath, schema);
  }

  async readJson<T = unknown>(
    filePath: string,
    options?: { schema?: z.ZodSchema; fallback?: any },
  ): Promise<T> {
    return await pathy(filePath).read(options);
  }

  async writeJson(
    filePath: string,
    data: unknown,
    options?: { schema?: z.ZodSchema },
  ) {
    if (!this.isReadOnly) {
      await pathy(filePath).write(data, options);
    }
  }
}
