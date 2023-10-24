import { Pathy, pathy } from '@bscotch/pathy';
import type { Mote, MoteId, PackedData, SchemaId } from './types.js';
import { resolvePointer } from './util.js';

export class Packed {
  protected data!: PackedData;

  protected constructor(readonly yypPath: Pathy) {}

  get packedPath() {
    return pathy<PackedData>('datafiles/gcdata/packed.json', this.yypPath.up());
  }

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

  getMoteName(mote: Mote | string): string {
    mote = typeof mote === 'string' ? this.getMote(mote) : mote;
    const schema = this.getSchema(mote.schema_id);
    if (!schema || !schema.name) {
      return mote.id;
    }
    return resolvePointer(schema.name, mote.data) || mote.id;
  }

  getMote(moteId: string | MoteId) {
    return this.data.motes[moteId as MoteId];
  }

  getSchema(schemaId: string | SchemaId) {
    return this.data.schemas[schemaId as SchemaId];
  }

  listMotesBySchema<D = unknown>(
    ...schemaId: (string | SchemaId)[]
  ): Mote<D>[] {
    return Object.values(this.data.motes).filter((mote) =>
      schemaId.includes(mote.schema_id),
    ) as Mote<D>[];
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
