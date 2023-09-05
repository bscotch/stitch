import { Pathy, pathy } from '@bscotch/pathy';
import { assert } from 'chai';
import { SpriteSourcePaths, getSpriteSourcePaths } from './paths.js';
import {
  SpriteStaging,
  spriteSourceConfigSchema,
  type SpriteSourceConfig,
} from './types.js';
import { AnyFunc, AsyncableChecked, check, rethrow } from './utility.js';

interface Issue {
  kind: 'error' | 'warning';
  message: string;
  cause?: any;
}

export class SpriteSource {
  readonly issues: Issue[] = [];
  readonly paths: SpriteSourcePaths;

  constructor(readonly sourceDirPath: string | Pathy) {
    this.paths = getSpriteSourcePaths(sourceDirPath);
  }

  protected async resolveStaged(staging: SpriteStaging) {
    const dir = this.paths.root.join(staging.dir);
    if (!(await dir.exists())) {
      this.issues.push({
        kind: 'warning',
        message: `Staging directory does not exist: ${dir}`,
      });
      return;
    }
    // TODO: Identify all "Sprites"
    // TODO: For each transform, filter to matching sprites, then:
    // TODO: Handle bleed
    // TODO: Handle crop
    // TODO: Handle move (including renames)
    // TODO: Delete extra files in target
  }

  protected check<T extends AnyFunc>(
    func: T,
    message: string,
  ): AsyncableChecked<T> {
    const results = check(func, message);
    if (results instanceof Promise) {
      void results.then(([error, result]) => {
        if (error) {
          this.issues.push({ kind: 'error', message, cause: error });
        }
        return [error, result];
      });
    }
    return results;
  }

  async import(
    targetProject: string | Pathy,
    /** Optionally override config options */
    options: SpriteSourceConfig,
  ) {
    const start = Date.now();
    const project = pathy(targetProject);

    // Reset issues
    this.issues.length = 0;

    // Validate options. Show error out if invalid.
    try {
      options = spriteSourceConfigSchema.parse(options);
    } catch (err) {
      rethrow(err, 'Invalid SpriteSource options');
    }
    const paths = getSpriteSourcePaths(this.sourceDirPath);
    assert(
      await paths.root.isDirectory(),
      'Source must be an existing directory.',
    );
    assert(
      project.hasExtension('yy') && (await project.exists()),
      'Target must be an existing .yy file.',
    );

    // Update the config
    await paths.stitch.ensureDirectory();
    const config = await paths.config.read({ fallback: {} });
    if (options.ignore !== undefined) {
      config.ignore = options.ignore;
    }
    if (options.staging !== undefined) {
      config.staging = options.staging;
    }
    await paths.config.write(config);

    // Process any staging folders
    for (const staging of config.staging ?? []) {
      // Do them sequentially since later patterns could overlap earlier ones
      await this.resolveStaged(staging);
    }

    console.log(`Imported from sprite source in ${Date.now() - start}ms`);
  }
}
