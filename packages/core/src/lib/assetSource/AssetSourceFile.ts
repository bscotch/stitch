import { Pathy } from '@bscotch/pathy';
import { parseFile } from 'music-metadata';
import { ZodSchema, ZodTypeDef } from 'zod';
import { fileChecksum } from './assetSource.lib.js';
import {
  audioFileSchema,
  deletedAssetSchema,
  isDeletedAsset,
  type DeletedAsset,
  type Asset,
  type AudioAsset,
} from './assetSource.types.js';

/**
 * Compute the type of a record that results from diffing
 * the keys of two records (the keys that are only in the `Left` record).
 */
export type DiffByKeys<Left, Right> = {
  [Key in keyof Left as Key extends keyof Right ? never : Key]: Left[Key];
};

/**
 * Vue-style props definitions, with prop names as keys mapping to
 * functions that return the prop value.
 */
export type Props<T, S> = {
  [Key in keyof T]: (arg: S) => T[Key] | Promise<T[Key]>;
};

export interface AssetSourceFileOptions<T extends Asset> {
  /**
   * Path to the file, such that the instance cwd is the
   * directory containing the config.
   */
  path: Pathy;
  metaSchema: ZodSchema<T, ZodTypeDef, unknown>;
  props: Props<DiffByKeys<T, Asset>, this>;
  meta?: T | DeletedAsset;
}

export class AssetSourceFile<T extends Asset> {
  constructor(protected options: AssetSourceFileOptions<T>) {}

  get path() {
    return this.options.path;
  }

  async isDeleted(): Promise<boolean> {
    return !(await this.options.path.exists());
  }

  /**
   * If the file does not exist, returns `undefined`. Else
   * returns its checksum.
   */
  async computeChecksum(): Promise<string | undefined> {
    if (await this.isDeleted()) {
      return;
    }
    // Calculating the actual checksum is slow, so we only want to do it
    // if we're double-checking because modified-by-date is not reliable.
    return await fileChecksum(this.options.path);
  }

  // /**
  //  * If the file has been updated/added, returns the new checksum.
  //  * If the file has been deleted, returns an empty string `''`.
  //  * If the file has not been deleted or updated, returns `undefined`.
  //  */
  // async checksumIfUpdated(): Promise<string | undefined> {
  //   const currentChecksum = await this.computeChecksum();
  //   const oldChecksum = this.options.meta
  //     ? isDeletedAsset(this.options.meta)
  //       ? undefined
  //       : this.options.meta.checksum
  //     : undefined;
  //   if (currentChecksum === oldChecksum) {
  //     return;
  //   }
  //   if (oldChecksum && !currentChecksum) {
  //     return '';
  //   }
  //   return currentChecksum;
  // }

  async refresh(): Promise<this> {
    const exists = await this.options.path.exists();
    const updatedAt =
      (exists && (await this.options.path.stat()).mtime) || undefined;
    const partialUpdated = {
      id: this.options.meta?.id,
      path: this.options.path.relative,
      version: (this.options.meta?.version ?? -1) + 1,
      updatedAt: updatedAt?.toISOString(),
      importable: false,
    };

    if (this.options.meta && isDeletedAsset(this.options.meta) && !exists) {
      // Then we have a deleted asset that is still deleted
      return this;
    } else if (this.options.meta && !exists) {
      // Then we have a recently-deleted asset
      this.options.meta = deletedAssetSchema.parse({
        ...partialUpdated,
        deleted: true,
      });
    } else if (
      this.options.meta &&
      !isDeletedAsset(this.options.meta) &&
      exists &&
      this.options.meta.updatedAt == partialUpdated.updatedAt
    ) {
      // Then we have an unchanged asset. Mkake sure we have a checksum.
      this.options.meta.checksum ||= await this.computeChecksum();
    } else {
      // Then something has changed
      const props: Partial<DiffByKeys<T, Asset>> = {};
      for (const key of Object.keys(
        this.options.props || {},
      ) as (keyof typeof props)[]) {
        const value = this.options.props[key](this as any);
        props[key] = value instanceof Promise ? await value : value;
      }
      this.options.meta = this.options.metaSchema.parse({
        ...partialUpdated,
        ...props,
        checksum: await this.computeChecksum(),
      });
    }
    return this;
  }

  toJSON(): T | DeletedAsset {
    return { ...this.options.meta } as T | DeletedAsset;
  }
}

export class AssetSourceFileAudio extends AssetSourceFile<AudioAsset> {
  constructor(path: Pathy, meta?: AudioAsset | DeletedAsset) {
    super({
      path,
      metaSchema: audioFileSchema,
      meta,
      props: {
        duration: async (asset) => {
          try {
            const metadata = await parseFile(asset.path.absolute);
            return metadata.format.duration!;
          } catch (err) {
            console.error(
              'WARNING: Could not parse audio file',
              asset.path.absolute,
              (err as Error)?.message,
            );
            return 0;
          }
        },
      },
    });
  }

  static from(path: Pathy, meta: AudioAsset | DeletedAsset) {
    return new AssetSourceFileAudio(path, meta);
  }
}
