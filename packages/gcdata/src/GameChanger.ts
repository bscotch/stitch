import { Client, Glossary } from '@bscotch/cl2-string-server-shared';
import { Pathy, pathy } from '@bscotch/pathy';
import fetch from 'node-fetch';
import { gameChangerEvents } from './GameChanger.events.js';
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
  isBschemaBoolean,
  isBschemaConst,
  isBschemaEnum,
  isBschemaNumeric,
  isBschemaString,
  type Mote,
  type MoteId,
  type PackedData,
  type SchemaId,
} from './types.js';
import {
  resolvePointer,
  resolvePointerInSchema,
  setValueAtPointer,
} from './util.js';

interface MoteVisitorDataCtx {
  /** The data at this point in the heirarchy */
  data: any;
  /** The key in the parent that points to this data. `undefined` at the data root */
  key: string | undefined;
  /** The full pointer, as a split array of strings, to the this data. Empty at the data root */
  pointer: string[];
  /** The subschema mapping onto this data */
  subschema: Bschema;
}

export interface MoteVisitorCtx<T = undefined> {
  mote: Mote;
  schema: Bschema;
  current: MoteVisitorDataCtx;
  /** `undefined` at the root, otherwise the prior visitor context data */
  parent: MoteVisitorCtx<T> | undefined;
  /** A place for your custom store to accumulate things during visits. Passed by reference. */
  store: T;
}

export class Gcdata {
  constructor(public data: PackedData) {}
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

  visitMoteData<R>(
    moteId: string | Mote,
    /** Function to call on every node in the mote data */
    visitor: (ctx: MoteVisitorCtx, priorVisitorReturn?: R | undefined) => R,
  ): R;
  visitMoteData<Store, R>(
    moteId: string | Mote,
    visitor: (
      ctx: MoteVisitorCtx<Store>,
      priorVisitorReturn?: R | undefined,
    ) => R,
    store: Store,
  ): R;
  visitMoteData(
    moteId: string | Mote,
    visitor: (ctx: MoteVisitorCtx<any>, priorVisitorReturn?: any) => any,
    store?: any,
  ) {
    const mote = this.getMote(moteId);
    assert(mote, `Cannot visit non-existent mote ${moteId}`);
    const schema = this.getSchema(mote.schema_id);
    assert(schema, `Cannot visit mote ${moteId}: schema not found`);
    const initialCtx: MoteVisitorCtx<any> = {
      mote,
      schema,
      current: {
        data: mote.data,
        key: undefined,
        pointer: [],
        subschema: schema,
      },
      parent: undefined,
      store,
    };

    const visit = (ctx: MoteVisitorCtx<any>, priorResult: any) => {
      // Call on this node!
      priorResult = visitor(ctx, priorResult);
      // Then visit the children
      // Get each data field (there are no arrays, so that simplifies things!)
      const data = ctx.current.data;
      if (typeof data === 'object' && data !== null) {
        for (const key of Object.keys(data)) {
          const pointer = [...ctx.current.pointer, key];
          const subschema = resolvePointerInSchema(pointer, ctx.mote, this);
          if (!subschema) {
            console.warn(
              `Could not resolve pointer ${pointer.join('/')} for schema ${
                ctx.mote.schema_id
              }`,
            );
            continue;
          }
          const newCtx: MoteVisitorCtx = {
            ...ctx,
            current: {
              data: data[key],
              key,
              pointer,
              subschema,
            },
            parent: ctx,
          };
          visit(newCtx as MoteVisitorCtx, priorResult);
        }
      }
    };
    visit(initialCtx, undefined);
  }

  getAncestors(
    ofMoteId: Mote | string,
    options?: {
      /** If true, circularity will cause an early return of the parents rather than throwing. */
      ignoreCircularity: boolean;
    },
  ): Mote[] {
    const mote = this.getMote(ofMoteId);
    assert(mote, `Cannot get parents: mote not found ${ofMoteId}`);
    const hierarchy: Mote[] = [];
    let parent: Mote | undefined = this.getMote(mote.parent)!;
    const seen = new Set<string>();
    while (parent) {
      hierarchy.push(parent);
      parent = this.getMote(parent.parent);
      // Prevent infinite loops
      if (parent && seen.has(parent.id)) {
        if (options?.ignoreCircularity) break;
        throw new Error(`Mote ${parent.id} is in a circular hierarchy!`);
      } else if (parent) {
        seen.add(parent.id);
      }
    }
    return hierarchy.reverse();
  }

  getMoteNamePointer(mote: Mote | string | undefined): string | undefined {
    if (!mote) return undefined;
    const foundMote = this.getMote(mote);
    if (!foundMote) return undefined;
    const schema = this.getSchema(foundMote.schema_id);
    return schema?.name;
  }

  getMoteName(moteId: Mote | string | undefined): string | undefined {
    const pointer = this.getMoteNamePointer(moteId);
    const mote = this.getMote(moteId);
    if (!pointer || !mote) {
      return mote?.id;
    }
    return resolvePointer(pointer, mote.data) || mote.id;
  }

  getMote<T = any>(
    moteId: Mote | string | MoteId | undefined,
  ): Mote<T> | undefined {
    if (!moteId) return;
    return this.data.motes[typeof moteId === 'string' ? moteId : moteId.id];
  }

  getSchema(schemaId: string | SchemaId | undefined): Bschema | undefined {
    if (!schemaId) return;
    return this.data.schemas[schemaId as SchemaId];
  }

  listMotes(): Mote[] {
    return Object.values(this.data.motes);
  }

  listMotesBySchema<D = unknown>(
    ...schemaId: (string | SchemaId)[]
  ): Mote<D>[] {
    return Object.values(this.data.motes).filter((mote) =>
      schemaId.includes(mote.schema_id),
    ) as Mote<D>[];
  }

  static async from(gcdataFile: Pathy) {
    const data = JSON.parse(await gcdataFile.read({ parse: false }));
    return new Gcdata(data);
  }
}

export class GameChanger {
  base!: Gcdata;
  working!: Gcdata;
  protected changes!: Changes;
  glossary?: Glossary;

  protected constructor(readonly projectName: string) {}

  protected get workingData(): PackedData {
    return this.working.data;
  }

  protected get baseData(): PackedData {
    return this.base.data;
  }

  get projectSaveDir() {
    return GameChanger.projectSaveDir(this.projectName);
  }

  /**
   * Clear diffs for a subset of pointer patterns. This is so that
   * diff types that are fully represented by other editors can be
   * cleared, while leaving other changes intact.
   */
  clearMoteChanges(moteId: string, patterns: string[]) {
    const priorDiffs = this.changes.changes.motes?.[moteId]?.diffs;
    if (!priorDiffs) return;
    const diffPointers: string[] = Object.keys(priorDiffs);
    if (!diffPointers.length) return;

    for (const pattern of patterns) {
      const patternParts = pattern.split('/');
      diff: for (const diffPointer of diffPointers) {
        // Compare each part of the pointer and pattern. If all match, delete the diff.
        const diffPointerParts = diffPointer.split('/');
        if (diffPointerParts.length < patternParts.length) continue;
        for (let i = 0; i < patternParts.length; i++) {
          if (patternParts[i] === '*') continue; // Always allowed
          if (patternParts[i] !== diffPointerParts[i]) {
            // Then this diff does not match the pattern!
            continue diff;
          }
        }
        // If we made it here then we had a match. Delete it!
        delete priorDiffs[diffPointer];
      }
    }
    // Remove the working version, then recreate it from the diffs
    delete this.working.data.motes[moteId];
    if (this.base.data.motes[moteId]) {
      this.working.data.motes[moteId] = structuredClone(
        this.base.data.motes[moteId],
      );
    }
    this.applyChanges();
  }

  updateMoteLocation(
    moteId: string,
    newParentId: string | undefined,
    newFolder: string | undefined,
  ) {
    assert(moteId && typeof moteId === 'string', 'Must specify mote ID');
    assert(
      newParentId === undefined || typeof newParentId === 'string',
      'Parent ID must be a string or undefined',
    );
    assert(
      newFolder === undefined ||
        (typeof newFolder === 'string' && newFolder.length > 0),
      'Folder must be a string or undefined',
    );
    const mote = this.working.getMote(moteId);
    assert(mote, `Cannot update non-existent mote ${moteId}`);
    const parent = newParentId ? this.working.getMote(newParentId) : undefined;
    assert(
      parent || newParentId === undefined,
      `Cannot find mote ${newParentId}`,
    );

    setValueAtPointer(this.working.data.motes[moteId], 'parent', parent?.id);
    setValueAtPointer(this.working.data.motes[moteId], 'folder', newFolder);

    // See if we have a change relative to the base
    const baseMote = this.base.getMote(moteId);
    const baseParent = baseMote?.parent;
    let changedParent = baseParent !== parent?.id;
    let changedFolder = baseMote?.folder !== newFolder;
    if (!changedParent) {
      // Then we haven't changed from the base data, but
      // we might be *undoing* a working data change.
      delete this.changes.changes.motes?.[moteId]?.diffs?.parent;
    } else {
      this.createChange('motes', moteId, {
        type: 'changed',
        pointer: 'parent',
        newValue: parent?.id,
      });
    }
    if (!changedFolder) {
      delete this.changes.changes.motes?.[moteId]?.diffs?.folder;
    } else {
      this.createChange('motes', moteId, {
        type: 'changed',
        pointer: 'folder',
        newValue: newFolder,
      });
    }
  }

  createMote(schemaId: string, moteId: string) {
    assert(schemaId, 'Must specify schema ID');
    assert(moteId, 'Must specify mote ID');
    assert(
      !this.working.getMote(moteId),
      `Mote ${moteId} already exists in the working copy`,
    );
    const schema = this.working.getSchema(schemaId);
    assert(schema, `Schema ${schemaId} does not exist`);

    this.changes.changes.motes ||= {};

    // If we already have this mote in changes, we cannot proceed
    assert(
      !this.changes.changes.motes[moteId],
      `Mote ${moteId} already exists in changes`,
    );

    // Create the full change entry for the added mote
    const item = changeSchema.parse({
      mote_id: moteId,
      mote_name: moteId,
      schema_id: schemaId,
      schema_title: schema.title,
      type: 'added',
      diffs: {
        id: [null, moteId],
        schema_id: [null, schemaId],
      },
    });
    this.changes.changes.motes[moteId] = item;

    this.applyChanges();
    const mote = this.working.getMote(moteId);
    assert(mote, `Mote ${moteId} not found after creation`);
    gameChangerEvents.emit('gamechanger-working-updated', mote);
    return mote;
  }

  updateMoteData(moteId: string, dataPath: string, value: any) {
    assert(moteId, 'Must specify mote ID');
    assert(
      typeof dataPath === 'string' && dataPath.startsWith('data/'),
      'Data path must start with "data/"',
    );

    // Make sure this is a valid request
    const workingMote = this.working.getMote(moteId);
    assert(workingMote, `Cannot update non-existent mote ${moteId}`);
    const schema = this.working.getSchema(workingMote.schema_id);
    assert(schema, `Mote schema ${workingMote.schema_id} does not exist`);

    // // Need a data structure that can be used for reference
    // // when resolving schema pointers, to handle oneOfs.
    const sampleDataFromPath = setValueAtPointer(
      {
        id: moteId,
        schema_id: this.working.getMote(moteId)?.schema_id,
        data: {},
      } as Mote,
      dataPath,
      value,
    );

    const subschema = resolvePointerInSchema(
      dataPath.replace(/^data\//, ''),
      workingMote,
      this.working,
      sampleDataFromPath,
    );
    assert(
      subschema,
      `Could not resolve ${dataPath} in schema ${workingMote.schema_id}}`,
    );

    // Do some basic schema validation to avoid really dumb errors
    if (isBschemaConst(subschema)) {
      assert(
        value === null || value === subschema.bConst,
        `Expected constant value ${JSON.stringify(
          subschema.bConst,
        )}, got ${JSON.stringify(value)}`,
      );
    } else if (isBschemaEnum(subschema)) {
      assert(
        value === null || subschema.enum.includes(value),
        `'${value}' is not in enum ${JSON.stringify(subschema.enum)}`,
      );
    } else if (typeof value === 'string') {
      assert(
        isBschemaString(subschema),
        `Invalid value '${JSON.stringify(
          value,
        )}'. Schema for ${dataPath} is not for a string.`,
      );
    } else if (typeof value === 'boolean') {
      assert(
        isBschemaBoolean(subschema),
        `Invalid value '${JSON.stringify(
          value,
        )}'. Schema for ${dataPath} is not boolean`,
      );
    } else if (typeof value === 'number') {
      assert(
        isBschemaBoolean(subschema) || isBschemaNumeric(subschema),
        `Invalid value '${JSON.stringify(
          value,
        )}'. Schema for ${dataPath} is not numeric`,
      );
    }

    // Update the working data
    setValueAtPointer(this.working.data.motes[moteId], dataPath, value);

    // See if we have a change relative to the base
    const currentValue =
      resolvePointer(dataPath, this.base.getMote(moteId)) ??
      (subschema.defaultValue === undefined
        ? null
        : structuredClone(subschema.defaultValue));
    value = value ?? null;
    if (currentValue == value) {
      // Then we haven't changed from the base data, but
      // we might be *undoing* a working data change.
      delete this.changes.changes.motes?.[moteId]?.diffs?.[dataPath];
      return;
    }
    this.createChange('motes', moteId, {
      type: 'changed',
      pointer: dataPath,
      newValue: value,
    });
  }

  protected createChange(
    category: 'schemas' | 'motes',
    id: string,
    change: { type: ChangeType; pointer?: string; newValue?: any },
  ) {
    const moteId = category === 'motes' ? id : undefined;
    assert(
      moteId || category === 'schemas',
      'Must specify mote ID for mote changes',
    );
    const mote = moteId
      ? this.working.getMote(moteId) || change.newValue
      : undefined;
    const schemaId = category === 'schemas' ? id : mote?.schema_id;
    assert(schemaId, 'Could not determine schema ID for change');
    assert(
      !moteId || this.working.getMote(moteId) || change.type === 'added',
      `Mote ${id} does not exist`,
    );
    if (category === 'motes' && change.type === 'added') {
      assert(!this.working.getMote(moteId), `Mote ${moteId} already exists`);
    }
    if (category === 'schemas' && change.type === 'added') {
      assert(
        !this.working.getSchema(schemaId),
        `Schema ${schemaId} already exists`,
      );
    }
    assert(
      (category === 'schemas' && change.type === 'added') ||
        this.working.getSchema(schemaId),
      `Schema ${schemaId} does not exist`,
    );

    const schema = this.working.getSchema(schemaId);
    this.changes.changes[category] ||= {};
    const item = changeSchema.parse(
      this.changes.changes[category]?.[id] || {
        mote_id: moteId,
        schema_id: schemaId,
        schema_title: schema?.title,
        type: change.type,
      },
    );
    item.mote_name ||= this.working.getMoteName(moteId);
    this.changes.changes[category][id] = item;
    if (change.type === 'deleted') {
      item.type = 'deleted';
      delete item.diffs;
    } else if (change.pointer) {
      let originalValue = resolvePointer(
        change.pointer,
        this.baseData[category][id],
      );
      originalValue = originalValue === undefined ? null : originalValue;
      change.newValue = change.newValue === undefined ? null : change.newValue;
      if (originalValue !== change.newValue) {
        item.diffs ||= {};
        item.diffs[change.pointer] = [originalValue, change.newValue];
      }
    }

    this.applyChanges();
    gameChangerEvents.emit('gamechanger-working-updated', mote);
  }

  async writeChanges() {
    // Write it to a backup file first (to ensure that the GameChanger)
    // doesn't clobber what we've done without a recovery option.
    // Then write it to the actual file.
    const backupsFolder = GameChanger.projectGameChangerChangesBackupFolder(
      this.projectName,
    );
    await backupsFolder.ensureDirectory();
    const changesFile = GameChanger.projectGameChangerChangesFile(
      this.projectName,
    );
    if (await changesFile.exists()) {
      // Copy it to the backup folder
      const now = new Date();
      const parts = [
        now.getFullYear(),
        now.getMonth() + 1,
        now.getDate(),
        now.getHours(),
        now.getMinutes(),
        now.getSeconds(),
      ].map((n) => n.toString().padStart(2, '0'));
      const timestamp = parts.join('');
      const backupFile = backupsFolder.join(`${timestamp}.changes.json`);
      await changesFile.copy(backupFile);
    }
    await GameChanger.projectGameChangerChangesFile(this.projectName).write(
      this.changes,
    );
    gameChangerEvents.emit('gamechanger-changes-saved');
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
        } else if (
          change.type === 'changed' &&
          !Object.keys(change.diffs || {}).length
        ) {
          // Then we can remove this change entry altogether
          delete this.changes.changes[type][id];
          continue;
        }
        // Ensure the base object exists
        this.workingData[type][id] ||= {} as any;
        for (const [pointer, diff] of Object.entries(change.diffs || {})) {
          let data = this.workingData[type][id] as any;
          const dataPath = [{ data, key: undefined as string | undefined }];
          const pointerParts = pointer.split('/');
          for (let p = 0; p < pointerParts.length; p++) {
            const part = pointerParts[p];
            const isLastPart = p === pointerParts.length - 1;
            if (isLastPart) {
              data[part] = diff[1];
            } else {
              data[part] ||= {};
            }
            data = data[part];
            dataPath.push({ data, key: part });
          }
          // Work backwards through the data, deleting it if it is empty
          // (except for the root!)
          for (let p = dataPath.length - 1; p > 0; p--) {
            const part = dataPath[p];
            // If the entry is `null`, `undefined`, or an empty object, delete it. Else break.
            if (
              part.data === undefined ||
              part.data === null ||
              (typeof part.data === 'object' &&
                Object.keys(part.data).length === 0)
            ) {
              const parent = dataPath[p - 1].data;
              delete parent[part.key!];
            } else break;
          }
        }
      }
    }
  }

  protected async loadChanges() {
    const changesFile = GameChanger.projectGameChangerChangesFile(
      this.projectName,
    );
    if (!(await changesFile.exists())) {
      const metadata = await this.readCommitsMetadata();
      // Get the commitIds, sorted descending by number
      const commitIds = Object.keys(metadata.item_metadata)
        .map((itemId) => metadata.item_metadata[itemId].name)
        .sort((a, b) => {
          const aNum = parseInt(a.replace(/^c/, ''));
          const bNum = parseInt(b.replace(/^c/, ''));
          return bNum - aNum;
        });
      assert(
        commitIds.length,
        'No commits found. Open the GameChanger to download the latest commit.',
      );

      const initial = {
        changes: {
          message: '',
          motes: {},
          schemas: {},
          conflicts: { motes: {}, schemas: {} },
        },
        commitId: commitIds[0],
      };
      await changesFile.write(initial);
    }
    this.changes = await changesFile.read();
  }

  protected async readCommitsMetadata(): Promise<GameChangerRumpusMetadata> {
    const metadataFile = GameChanger.projectRumpusGameChangerMetadataFile(
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
    const commitItemFile = GameChanger.projectRumpusGameChangerDir(
      this.projectName,
    ).join(commitItemId);
    assert(
      await commitItemFile.exists(),
      `Could not find commit item file "${commitItemFile}"`,
    );
    const baseData = JSON.parse(await commitItemFile.read({ parse: false }));
    this.base ||= new Gcdata(baseData);
    this.base.data = baseData;
    const workingData = structuredClone(baseData);
    this.working ||= new Gcdata(workingData);
    this.working.data = workingData;
    this.applyChanges();
  }

  async loadGlossary(access: {
    host: string;
    username: string;
    password: string;
  }) {
    const client = new Client({
      baseUrl: access.host,
      password: access.password,
      user: access.username,
      // @ts-expect-error A type mismatch, but this is the correct thing!
      fetch,
    });
    this.glossary = await Glossary.create(client);
    return this.glossary;
  }

  /**
   * @param path Either the path to a .yyp file (to get the included packed file) or the direct path to a GameChanger snapshot (e.g. a packed file or a base file).
   */
  static async from(projectName: string): Promise<GameChanger | undefined> {
    const gcdata = new GameChanger(projectName);
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
    return this.projectGameChangerChangesFolder(projectName)
      .join('changes.json')
      .withValidator(changesSchema);
  }

  static projectGameChangerChangesFolder(projectName: string) {
    return this.projectSaveDir(projectName).join('gcdata');
  }

  static projectGameChangerChangesBackupFolder(projectName: string) {
    return this.projectGameChangerChangesFolder(projectName).join(
      'stitch-backups',
    );
  }
}
