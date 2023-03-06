import { YypIncludedFile } from '@bscotch/yy';
import { StitchStorage } from '../StitchStorage.js';
import { Gms2ComponentArrayWithStorage } from './Gms2ComponentArrayWithStorage.js';
import { Gms2IncludedFile } from './Gms2IncludedFile.js';

export class Gms2IncludedFileArray extends Gms2ComponentArrayWithStorage<
  YypIncludedFile,
  typeof Gms2IncludedFile
> {
  constructor(data: YypIncludedFile[], storage: StitchStorage) {
    super(data, Gms2IncludedFile, storage);
  }

  /**
   * Delete a file, if it exists.
   */
  deleteByName(baseName: string) {
    const fileIdx = this.items.findIndex((i) => i.name == baseName);
    if (fileIdx < 0) {
      return this;
    }
    const [file] = this.items.splice(fileIdx, 1);
    this.storage.deleteFileSync(file.filePathAbsolute);
    return this;
  }
}
