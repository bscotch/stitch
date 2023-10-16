import { Pathy } from '@bscotch/pathy';
import type { PackedData } from './types.js';

export class Packed {
  protected data!: PackedData;

  protected constructor(readonly yypPath: Pathy) {}

  get motes(): PackedData['motes'] {
    return {
      ...this.data.motes,
    };
  }

  get schemas(): PackedData['schemas'] {
    return {
      ...this.data.schemas,
    };
  }

  get packedPath() {
    return this.yypPath.up().join('datafiles/gcdata/packed.json');
  }

  async load() {
    this.data = await this.packedPath.read();
  }

  static async from(yypPath: Pathy): Promise<Packed | undefined> {
    const gcdata = new Packed(yypPath);
    if (await gcdata.packedPath.exists()) {
      await gcdata.load();
      return gcdata;
    }
    return;
  }
}
