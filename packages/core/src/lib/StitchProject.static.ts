import { Pathy } from '@bscotch/pathy';
import { oneline } from '@bscotch/utility';
import { Yy, Yyp } from '@bscotch/yy';
import { join } from 'path';
import { assert } from '../utility/errors.js';
import { assetsDirectory } from './constants.js';
import { gms2Platforms } from './StitchProject.constants.js';

export class StitchProjectStatic {
  static get supportedSoundFileExtensions() {
    return ['mp3', 'ogg', 'wav', 'wma'];
  }

  static get platforms() {
    return [...gms2Platforms] as const;
  }

  /**
   * Attempt to parse a YYP file.
   */
  static async parseYypFile(yypFilepath: string): Promise<Yyp> {
    const yyp = await Yy.read(yypFilepath, 'project');
    return yyp;
  }

  static async isValidYypFile(yypFilepath: string): Promise<boolean> {
    try {
      await StitchProjectStatic.parseYypFile(yypFilepath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Path to the `.yyp` file of the included,
   * default issue template project.
   */
  static get defaultProjectTemplatePath(): string {
    return join(assetsDirectory, 'issue-template', 'issue-template.yyp');
  }

  /**
   * Starting at a folder or .yyp file,
   * recursively list all .yyp files.
   *
   * If the `startingPath` is a .yyp filepath,
   * it will be returned as the sole entry in
   * an array.
   *
   * Files are read and smoke-tested to ensure
   * they are valid GameMaker project files.
   * Only those passing the test are returned.
   */
  static async listYypFilesRecursively(
    startingPath: string,
  ): Promise<string[]> {
    let paths = [startingPath];
    if (!startingPath.endsWith('.yyp')) {
      paths = await new Pathy(startingPath).listChildrenRecursively({
        includePatterns: [/\.yyp$/],
        transform: (p) => p.absolute,
      });
    }
    const areValid = await Promise.all(
      paths.map((p) => StitchProjectStatic.isValidYypFile(p)),
    );
    // Filter by valid (parseable) YYP files
    return paths.filter((_p, i) => areValid[i]);
  }

  static async findYypFile(startingPath: string): Promise<string> {
    // Find the yyp filepath
    const yypPaths = await StitchProjectStatic.listYypFilesRecursively(
      startingPath,
    );
    assert(
      yypPaths.length,
      `Couldn't find any Stitch-compatible .yyp files in "${startingPath}"`,
    );
    assert(
      yypPaths.length === 1,
      oneline`
          Found multiple Stitch-compatible .yyp files in "${startingPath}".
        `,
    );
    return yypPaths[0];
  }
}

export type Gms2Platform = typeof StitchProjectStatic.platforms[number];
