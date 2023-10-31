import { pathy } from '@bscotch/pathy';
import { GcdataError, assert } from './assert.js';
import {
  GameChangerRumpusMetadata,
  gameChangerRumpusMetadataSchema,
} from './types.cl2.rumpus.js';
import {
  Bschema,
  ChangeType,
  Changes,
  changeSchema,
  changesSchema,
  type Mote,
  type MoteId,
  type PackedData,
  type SchemaId,
} from './types.js';
import { resolvePointer } from './util.js';

export class Packed {
  protected baseData!: PackedData;
  protected workingData!: PackedData;
  protected changes!: Changes;

  protected constructor(readonly projectName: string) {}

  get motes(): PackedData['motes'] {
    return {
      ...this.workingData.motes,
    };
  }

  get schemas(): PackedData['schemas'] {
    return {
      ...this.workingData.schemas,
    };
  }

  getMoteName(mote: Mote | string | undefined): string | undefined {
    if (!mote) return undefined;
    const foundMote = typeof mote === 'string' ? this.getMote(mote) : mote;
    if (!foundMote) return undefined;
    const schema = this.getSchema(foundMote.schema_id);
    if (!schema || !schema.name) {
      return foundMote.id;
    }
    return resolvePointer(schema.name, foundMote.data) || foundMote.id;
  }

  getMote(moteId: string | MoteId | undefined): Mote | undefined {
    if (!moteId) return;
    return this.workingData.motes[moteId as MoteId];
  }

  getSchema(schemaId: string | SchemaId | undefined): Bschema | undefined {
    if (!schemaId) return;
    return this.workingData.schemas[schemaId as SchemaId];
  }

  listMotes(): Mote[] {
    return Object.values(this.workingData.motes);
  }

  listMotesBySchema<D = unknown>(
    ...schemaId: (string | SchemaId)[]
  ): Mote<D>[] {
    return Object.values(this.workingData.motes).filter((mote) =>
      schemaId.includes(mote.schema_id),
    ) as Mote<D>[];
  }

  async createChange(
    category: 'schemas' | 'motes',
    type: ChangeType,
    id: string,
    pointer?: string,
    newValue?: any,
  ) {
    const moteId = category === 'motes' ? id : undefined;
    assert(
      moteId || category === 'schemas',
      'Must specify mote ID for mote changes',
    );
    const mote = moteId ? this.getMote(moteId) || newValue : undefined;
    const schemaId = category === 'schemas' ? id : mote?.schema_id;
    assert(schemaId, 'Could not determine schema ID for change');
    assert(
      !moteId || this.getMote(moteId) || type === 'added',
      `Mote ${id} does not exist`,
    );
    if (category === 'motes' && type === 'added') {
      assert(!this.getMote(id), `Mote ${id} already exists`);
    }
    if (category === 'schemas' && type === 'added') {
      assert(!this.getSchema(id), `Schema ${id} already exists`);
    }
    assert(
      (category === 'schemas' && type === 'added') || this.getSchema(id),
      `Schema ${id} does not exist`,
    );

    this.changes.changes[category] ||= {};
    const item = changeSchema.parse(
      this.changes.changes[category]?.[id] || {
        mote_id: moteId,
        schema_id: schemaId,
        type,
      },
    );
    item.mote_name ||= this.getMoteName(moteId);
    this.changes.changes[category][id] = item;
    if (type === 'deleted') {
      item.type = 'deleted';
      delete item.diffs;
    } else if (pointer) {
      let originalValue = resolvePointer(pointer, this.baseData[category][id]);
      originalValue = originalValue === undefined ? null : originalValue;
      newValue = newValue === undefined ? null : newValue;
      if (originalValue !== newValue) {
        item.diffs ||= {};
        item.diffs[pointer] = [originalValue, newValue];
      }
    }

    this.applyChanges();
    await Packed.projectGameChangerChangesFile(this.projectName).write(
      this.changes,
    );
  }

  /** Apply changes to the baseData to get the updated workingData */
  protected applyChanges() {
    assert(
      this.changes.commitId === this.baseData.commitId,
      'The changes and base data have different commit IDs',
    );
    // Apply changes
    for (const type of ['motes', 'schemas'] as const) {
      const ids = Object.keys(this.changes.changes[type]);
      for (const id of ids) {
        const change = this.changes.changes[type][id];
        if (change.type === 'deleted') {
          delete this.workingData[type][id];
          continue;
        }
        // Ensure the base object exists
        this.workingData[type][id] ||= {} as any;
        for (const [pointer, diff] of Object.entries(change.diffs || {})) {
          let data = this.workingData[type][id] as any;
          const pointerParts = pointer.split('/');
          for (let p = 0; p < pointerParts.length; p++) {
            const part = pointerParts[p];
            if (p === pointerParts.length - 1) {
              if (diff[1] === null) {
                delete data[part];
              } else {
                data[part] = diff[1];
              }
            } else {
              data[part] ||= {};
              data = data[part];
            }
          }
        }
      }
    }
  }

  protected async loadChanges() {
    const changesFile = Packed.projectGameChangerChangesFile(this.projectName);
    assert(
      await changesFile.exists(),
      'Could not find game-changer changes file. Open the GameChanger to ensure that it gets created.',
    );
    this.changes = await changesFile.read();
  }

  protected async readCommitsMetadata(): Promise<GameChangerRumpusMetadata> {
    const metadataFile = Packed.projectRumpusGameChangerMetadataFile(
      this.projectName,
    );
    assert(
      await metadataFile.exists(),
      'Could not find game-changer metadata file. Open the GameChanger to ensure that it gets created.',
    );
    // Consists of 3 lines. The first one is the JSON we want.
    const content = (await metadataFile.read({
      parse: false,
    })) as string;
    const [rawMetadata] = content.split('\n');
    assert(rawMetadata, 'Metadata file malformed.');
    try {
      return gameChangerRumpusMetadataSchema.parse(JSON.parse(rawMetadata));
    } catch (err) {
      const issue = new GcdataError(
        'Could not parse game-changer metadata file.',
      );
      issue.cause = err;
      throw err;
    }
  }

  async load() {
    await this.loadChanges();
    const metadata = await this.readCommitsMetadata();

    // Use the game-changer metadata file to find the base game-changer data
    const commitItemId = Object.keys(metadata.item_metadata).find(
      (itemId) => metadata.item_metadata[itemId].name === this.changes.commitId,
    );
    assert(
      commitItemId,
      `Could not find commit item with name "${this.changes.commitId}"`,
    );
    const commitItemFile = Packed.projectRumpusGameChangerDir(
      this.projectName,
    ).join(commitItemId);
    assert(
      await commitItemFile.exists(),
      `Could not find commit item file "${commitItemFile}"`,
    );
    this.baseData = JSON.parse(await commitItemFile.read({ parse: false }));
    this.workingData = structuredClone(this.baseData);
    this.applyChanges();
  }

  /**
   * @param path Either the path to a .yyp file (to get the included packed file) or the direct path to a GameChanger snapshot (e.g. a packed file or a base file).
   */
  static async from(projectName: string): Promise<Packed | undefined> {
    const gcdata = new Packed(projectName);
    try {
      await gcdata.load();
      return gcdata;
    } catch (err) {
      console.error(err);
      return undefined;
    }
  }

  static projectSaveDir(projectName: string) {
    return pathy(`${process.env.LOCALAPPDATA}/${projectName}`);
  }

  static projectRumpusGameChangerDir(projectName: string) {
    return this.projectSaveDir(projectName).join(
      'Dev/Rumpus/Crates/game-changer',
    );
  }

  static projectRumpusGameChangerMetadataFile(projectName: string) {
    return this.projectRumpusGameChangerDir(projectName).join('metadata');
  }

  static projectGameChangerChangesFile(projectName: string) {
    return this.projectSaveDir(projectName)
      .join('gcdata/changes.json')
      .withValidator(changesSchema);
  }
}
