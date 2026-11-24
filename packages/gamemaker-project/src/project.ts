import {
  getDefaultsForNewSound,
  isValidSoundName,
  isValidSpriteName,
} from '@bscotch/stitch-config';
import {
  SoundChannel,
  SpriteOrigin,
  SpriteType,
  yyObjectEventSchema,
  yyRoomInstanceLayerSchema,
  yyRoomInstanceSchema,
  yyRoomSchema,
  yySpriteSchema,
  type YyData,
  type YyObject,
  type YypResourceId,
  type YyRoom,
  type YySound,
  type YySprite,
} from '@bscotch/yy';
import { randomBytes } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import {
  instanceLayers,
  type Asset,
  type AssetKind,
  type AssetRef,
} from './asset.ts';
import {
  getEvent,
  getEventFromFilename,
  getEventFromLabel,
  type ObjectEvent,
} from './objectEvents.ts';
import { ProjectState, type GameMakerProjectOptions } from './project.state.ts';
import { referencesPath, replaceRefs } from './refs.ts';
import { fshDefault, vshDefault } from './shaderDefaults.ts';
import type { ParentRef, ProjectTransaction } from './transaction.ts';
import {
  assert,
  assertIsValidIdentifier,
  exists,
  findCaseInsensitive,
  folderPathToPosix,
  folderPathToYy,
  getPngSize,
  key,
  listDir,
  listFilesRecursively,
  splitPath,
  toPosix,
} from './util.ts';

export interface DeleteAssetResult {
  /**
   * Assets that still reference the deleted asset in a way that couldn't be
   * cleaned up automatically (e.g. a tileset using a deleted sprite).
   */
  danglingReferences: string[];
}

/**
 * A GameMaker project: its assets, folders, and settings, kept in sync with
 * the files on disk.
 *
 * - **Disk is the source of truth.** Every change is made in a transaction
 *   that re-reads the files it changes, so external changes (GameMaker, git)
 *   are never overwritten with stale data.
 * - **Changes are serialized.** Changes made through this class, and the
 *   processing of external changes, happen one at a time, in order.
 * - **Changes are observable.** Use {@link on} to listen for assets being
 *   added, removed or changed — whether by this class or by something else.
 *
 * This class knows nothing about GML semantics. Updating code that refers to
 * a renamed asset is the job of a higher layer.
 */
export class GameMakerProject extends ProjectState {
  /**
   * Load a project.
   * @param yypPathOrDir The path to the yyp file, or to the folder containing it.
   */
  static async open(
    yypPathOrDir: string,
    options: GameMakerProjectOptions = {},
  ): Promise<GameMakerProject> {
    const project = new GameMakerProject(
      await ProjectState.findYyp(yypPathOrDir),
      options,
    );
    await project.load();
    return project;
  }

  // --- Project settings ---

  /**
   * Set the GameMaker IDE version listed in the yyp. (The IDE overwrites
   * this with its own version when it saves the project.)
   */
  async setIdeVersion(version: string): Promise<void> {
    assert(
      /^\d+\.\d+\.\d+\.\d+$/.test(version),
      `Invalid version string: ${version}`,
    );
    await this.transaction(async (tx) => {
      (await tx.yyp()).MetaData.IDEVersion = version;
    });
  }

  /**
   * Make the yyp's "Included Files" list match the files in the `datafiles`
   * folder. Existing entries (and their settings) are kept.
   */
  async syncIncludedFiles(): Promise<void> {
    await this.transaction(async (tx) => {
      const yyp = await tx.yyp();
      const root = path.join(this.dir, 'datafiles');
      const existing = new Map(
        yyp.IncludedFiles.map((f) => [key(`${f.filePath}/${f.name}`), f]),
      );
      yyp.IncludedFiles = (await listFilesRecursively(root)).map((file) => {
        const relative = toPosix(path.relative(this.dir, file));
        const filePath = path.posix.dirname(relative);
        const name = path.posix.basename(relative);
        // Missing fields are filled in by the schema when the yyp is written
        return (
          existing.get(key(relative)) ||
          ({ filePath, name } as (typeof yyp.IncludedFiles)[number])
        );
      });
    });
  }

  // --- Folders ---

  /**
   * Create a folder in the asset tree (and any missing parent folders).
   * Returns its POSIX path.
   */
  async createFolder(folder: string | string[]): Promise<string> {
    return await this.transaction(async (tx) => {
      const parent = await tx.ensureFolder(folder);
      return folderPathToPosix(parent.path);
    });
  }

  /** Delete a folder and its subfolders. They must not contain any assets. */
  async deleteFolder(folder: string | string[]): Promise<void> {
    const posix = splitPath(folder).join('/');
    assert(posix, 'Cannot delete the root folder');
    await this.transaction(async (tx) => {
      assert(
        !this.listAssetsInFolder(posix, { recursive: true }).length,
        `Cannot delete folder "${posix}": it contains assets`,
      );
      const yyp = await tx.yyp();
      yyp.Folders = yyp.Folders.filter(
        (f) => !isSameOrSubfolder(f.folderPath, posix),
      );
    });
  }

  /**
   * Rename or move a folder, along with its subfolders and assets. If the
   * new folder already exists, the folders are merged.
   */
  async renameFolder(
    from: string | string[],
    to: string | string[],
  ): Promise<{ movedFolders: string[]; movedAssets: Asset[] }> {
    const fromPosix = splitPath(from).join('/');
    const toParts = splitPath(to);
    const toPosixPath = toParts.join('/');
    assert(fromPosix && toPosixPath, 'Cannot rename the root folder');
    assert(
      !isSameOrSubfolder(folderPathToYy(toPosixPath), fromPosix),
      `Cannot move folder "${fromPosix}" into itself`,
    );
    return await this.transaction(async (tx) => {
      const toMove = this.listAssetsInFolder(fromPosix, { recursive: true });
      const yyp = await tx.yyp();
      const movedFolders: string[] = [];
      const fromPrefix = `folders/${fromPosix}/`;
      const toPrefix = `folders/${toPosixPath}/`;
      // Move the subfolders and remove the old folder
      yyp.Folders = yyp.Folders.filter((f) => {
        if (key(f.folderPath) === key(folderPathToYy(fromPosix))) return false;
        if (key(f.folderPath).startsWith(key(fromPrefix))) {
          f.folderPath = toPrefix + f.folderPath.slice(fromPrefix.length);
          movedFolders.push(folderPathToPosix(f.folderPath));
        }
        return true;
      });
      // Dedupe in case of merges
      const seen = new Set<string>();
      yyp.Folders = yyp.Folders.filter((f) => {
        const k = key(f.folderPath);
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      });
      const target = await tx.ensureFolder(toParts);
      for (const asset of toMove) {
        const yy = (await tx.yy(asset)) as { parent: ParentRef };
        const current = folderPathToPosix(yy.parent.path);
        if (key(current) === key(fromPosix)) {
          yy.parent = { ...target };
        } else {
          const rest = current.slice(fromPosix.length + 1);
          yy.parent = {
            name: yy.parent.name,
            path: folderPathToYy(`${toPosixPath}/${rest}`),
          };
        }
        tx.stageYy(asset.yyPath, asset.kind, yy as YyData<AssetKind>);
      }
      return { movedFolders, movedAssets: toMove };
    });
  }

  /** Move an asset to a folder (created if it doesn't exist) */
  async moveAsset(asset: AssetRef, folder: string | string[]): Promise<void> {
    const target = this.requireAsset(asset);
    await this.transaction(async (tx) => {
      const yy = (await tx.yy(target)) as { parent: ParentRef };
      yy.parent = await tx.ensureFolder(folder);
      tx.stageYy(target.yyPath, target.kind, yy as YyData<AssetKind>);
    });
  }

  // --- Creating assets ---

  /**
   * Create a script.
   * @param assetPath The asset-tree path, ending with the script's name: `my/folder/scr_name`
   */
  async createScript(
    assetPath: string,
    content = '',
  ): Promise<Asset<'scripts'>> {
    const { name, folder } = this.parseNewAssetPath(assetPath);
    return await this.createAsset('scripts', name, async (tx, dir) => {
      await tx.writeFile(path.join(dir, `${name}.gml`), content);
      return { name, parent: await tx.ensureFolder(folder) };
    });
  }

  /**
   * Create an object, with a Create event.
   * @param assetPath The asset-tree path, ending with the object's name.
   */
  async createObject(
    assetPath: string,
    options?: { parent?: AssetRef<'objects'>; sprite?: AssetRef<'sprites'> },
  ): Promise<Asset<'objects'>> {
    const { name, folder } = this.parseNewAssetPath(assetPath);
    const parent = options?.parent
      ? this.requireAsset(options.parent, 'objects')
      : undefined;
    const sprite = options?.sprite
      ? this.requireAsset(options.sprite, 'sprites')
      : undefined;
    return await this.createAsset('objects', name, async (tx, dir) => {
      await tx.writeFile(path.join(dir, 'Create_0.gml'), '');
      return {
        name,
        parent: await tx.ensureFolder(folder),
        eventList: [yyObjectEventSchema.parse({ eventType: 0, eventNum: 0 })],
        parentObjectId: parent ? { ...parent.id } : null,
        spriteId: sprite ? { ...sprite.id } : null,
      } as Partial<YyObject>;
    });
  }

  /**
   * Create a sprite from a PNG image, with its origin in the middle.
   * @param assetPath The asset-tree path, ending with the sprite's name.
   */
  async createSprite(
    assetPath: string,
    fromImage: string,
  ): Promise<Asset<'sprites'>> {
    const { name, folder } = this.parseNewAssetPath(assetPath);
    assert(
      isValidSpriteName(name, this.config),
      `Sprite name "${name}" does not match the allowed patterns`,
    );
    const { width, height } = await getPngSize(fromImage);
    return await this.createAsset('sprites', name, async (tx, dir) => {
      const yy = yySpriteSchema.parse({
        name,
        parent: await tx.ensureFolder(folder),
        type: SpriteType.Default,
        origin: SpriteOrigin.MiddleCenter,
        width,
        height,
        sequence: {
          xorigin: Math.floor(width / 2),
          yorigin: Math.floor(height / 2),
        },
        frames: [{}],
      });
      await tx.copyFile(fromImage, path.join(dir, `${yy.frames[0].name}.png`));
      return yy;
    });
  }

  /**
   * Create a sound from an audio file. Defaults from the Stitch config's
   * `newSoundRules` are applied.
   * @param assetPath The asset-tree path, ending with the sound's name.
   */
  async createSound(
    assetPath: string,
    fromFile: string,
  ): Promise<Asset<'sounds'>> {
    const { name, folder } = this.parseNewAssetPath(assetPath);
    assert(
      isValidSoundName(name, this.config),
      `Sound name "${name}" does not match the allowed patterns`,
    );
    const defaults = getDefaultsForNewSound(name, this.config);
    return await this.createAsset('sounds', name, async (tx, dir) => {
      const soundFile = `${name}${path.extname(fromFile)}`;
      await tx.copyFile(fromFile, path.join(dir, soundFile));
      return {
        name,
        parent: await tx.ensureFolder(folder),
        type: defaults?.mono ? SoundChannel.Mono : SoundChannel.Stereo,
        soundFile,
        // Sound yy files have a different format in older projects
        resourceVersion: '$GMProject' in (await tx.yyp()) ? '2.0' : '1.0',
      } as Partial<YySound>;
    });
  }

  /**
   * Create an empty room, and add it to the end of the room order.
   * @param assetPath The asset-tree path, ending with the room's name.
   */
  async createRoom(assetPath: string): Promise<Asset<'rooms'>> {
    const { name, folder } = this.parseNewAssetPath(assetPath);
    return await this.createAsset('rooms', name, async (tx) => {
      const yy = yyRoomSchema.parse({
        name,
        parent: await tx.ensureFolder(folder),
        layers: [{ resourceType: 'GMRBackgroundLayer' }],
        views: Array.from({ length: 8 }, () => ({})),
      });
      yy.views[0].visible = true;
      return yy;
    });
  }

  /**
   * Create a shader with GameMaker's default pass-through source.
   * @param assetPath The asset-tree path, ending with the shader's name.
   */
  async createShader(assetPath: string): Promise<Asset<'shaders'>> {
    const { name, folder } = this.parseNewAssetPath(assetPath);
    return await this.createAsset('shaders', name, async (tx, dir) => {
      await tx.writeFile(path.join(dir, `${name}.fsh`), fshDefault);
      await tx.writeFile(path.join(dir, `${name}.vsh`), vshDefault);
      return { name, parent: await tx.ensureFolder(folder) };
    });
  }

  /**
   * Add an asset whose files already exist in the project folder (e.g. written
   * by a sprite importer) to the yyp, and put it in a folder. Its yy file must
   * be at the standard location: `<kind>/<name>/<name>.yy`.
   * @param assetPath The asset-tree path, ending with the asset's name.
   */
  async adoptAsset<K extends AssetKind>(
    kind: K,
    assetPath: string,
  ): Promise<Asset<K>> {
    const { name, folder } = this.parseNewAssetPath(assetPath);
    await this.transaction(async (tx) => {
      const yyp = await tx.yyp();
      assert(
        !yyp.resources.some((r) => key(r.id.name) === key(name)),
        `An asset named "${name}" already exists`,
      );
      const id = assetId(kind, name);
      const yyPath = path.join(this.dir, id.path);
      assert(await exists(yyPath), `No yy file found at ${yyPath}`);
      const yy = await tx.yyAt(yyPath, kind);
      (yy as { parent?: ParentRef }).parent = await tx.ensureFolder(folder);
      tx.stageYy(yyPath, kind, yy);
      yyp.resources.push({ id });
      if (kind === 'rooms') yyp.RoomOrderNodes.push({ roomId: { ...id } });
    });
    return this.requireAsset(name, kind);
  }

  /**
   * Create a copy of an asset.
   * @param newAssetPath The asset-tree path for the copy, ending with its
   * name. If there's no folder, the copy goes in the source's folder.
   */
  async duplicateAsset<K extends AssetKind>(
    source: AssetRef<K>,
    newAssetPath: string,
  ): Promise<Asset<K>> {
    const original = this.requireAsset(source);
    const parts = splitPath(newAssetPath);
    const { name } = this.parseNewAssetPath(newAssetPath);
    const folder =
      parts.length > 1 ? parts.slice(0, -1) : splitPath(original.folder);
    const newId = assetId(original.kind, name);
    return (await this.createAsset(original.kind, name, async (tx, dir) => {
      const renamer = fileRenamer(original.name, name);
      await tx.copyDir(original.dir, dir, renamer);
      const yy = structuredClone(await tx.yy(original)) as Record<string, any>;
      renameInOwnYy(yy, original.kind, original.id, newId, renamer);
      yy.parent = await tx.ensureFolder(folder);
      if (original.isKind('rooms')) {
        await this.renewRoomInstanceIds(tx, yy as YyRoom, dir);
      }
      return yy as YyData<K>;
    })) as Asset<K>;
  }

  // --- Renaming & deleting assets ---

  /**
   * Rename an asset, updating every reference to it in the project's yy
   * files (parent objects, object sprites, room instances, collision events,
   * the room order, ...).
   *
   * GML code is not updated: that's the job of a code-aware layer.
   *
   * The asset is replaced by a new {@link Asset}, which is returned.
   */
  async renameAsset<K extends AssetKind>(
    from: AssetRef<K>,
    to: string,
  ): Promise<Asset<K>> {
    const asset = this.requireAsset(from);
    assertIsValidIdentifier(to);
    if (to === asset.name) return asset;
    const caseOnly = key(to) === key(asset.name);
    const oldId = { ...asset.id };
    const newId = assetId(asset.kind, to);
    await this.transaction(async (tx) => {
      // (Inside the transaction, so that pending external changes are included)
      const referrers = this.listAssets().filter(
        (a) => a !== asset && referencesPath(a.yy, oldId.path),
      );
      if (!caseOnly) await this.assertNameAvailable(tx, to, asset.kind);
      const yyp = await tx.yyp();
      assert(
        yyp.resources.some((r) => key(r.id.name) === key(asset.name)),
        `Asset "${asset.name}" is not listed in the yyp`,
      );
      const renamer = fileRenamer(asset.name, to);
      const yy = structuredClone(await tx.yy(asset)) as Record<string, any>;
      const newDir = path.join(path.dirname(asset.dir), to);

      if (caseOnly) {
        // Move in place, via a temporary name (needed on case-insensitive
        // file systems)
        const temp = path.join(
          path.dirname(asset.dir),
          `${to}.stitch-${randomBytes(4).toString('hex')}`,
        );
        await tx.rename(asset.dir, temp);
        for (const file of await listFilesRecursively(temp)) {
          const relative = toPosix(path.relative(temp, file));
          const renamed = renamer(relative);
          if (renamed !== relative) {
            await tx.rename(file, path.join(temp, renamed));
          }
        }
        await tx.rename(temp, newDir);
      } else {
        await tx.copyDir(asset.dir, newDir, renamer);
        tx.deleteOnCommit(asset.dir);
      }
      renameInOwnYy(yy, asset.kind, oldId, newId, renamer);
      tx.stageYy(path.join(newDir, `${to}.yy`), asset.kind, yy as any);

      // Update references elsewhere
      replaceRefs(yyp, oldId, newId);
      for (const other of referrers) {
        const data = await tx.yy(other);
        replaceRefs(data, oldId, newId);
        tx.stageYy(other.yyPath, other.kind, data);
        if (other.isKind('objects') && asset.isKind('objects')) {
          // Collision events are named after the other object
          const file = await findCaseInsensitive(
            other.dir,
            `Collision_${oldId.name}.gml`,
          );
          if (file) {
            await tx.rename(file, path.join(other.dir, `Collision_${to}.gml`));
          }
        }
      }
    });
    return this.requireAsset(to) as Asset<K>;
  }

  /**
   * Delete an asset and its files.
   *
   * References to it are cleaned up where that's safe: object parents and
   * sprites are unset, collision events with it are removed, its instances
   * are removed from rooms, and it is removed from the room order. Any
   * remaining references are reported.
   */
  async deleteAsset(ref: AssetRef): Promise<DeleteAssetResult> {
    const asset = this.requireAsset(ref);
    const id = { ...asset.id };
    return await this.transaction(async (tx) => {
      const referrers = this.listAssets().filter(
        (a) => a !== asset && referencesPath(a.yy, id.path),
      );
      const yyp = await tx.yyp();
      yyp.resources = yyp.resources.filter(
        (r) => key(r.id.name) !== key(asset.name),
      );
      yyp.RoomOrderNodes = yyp.RoomOrderNodes.filter(
        (n) => key(n.roomId.path) !== key(id.path),
      );
      const danglingReferences: string[] = [];
      for (const other of referrers) {
        const yy = (await tx.yy(other)) as Record<string, any>;
        // Unset top-level references (parentObjectId, spriteId, parentRoom, ...)
        for (const [field, value] of Object.entries(yy)) {
          if (value && typeof value === 'object' && !Array.isArray(value)) {
            if (key(value.path ?? '') === key(id.path)) yy[field] = null;
          }
        }
        if (other.isKind('objects')) {
          const object = yy as YyObject;
          const before = object.eventList.length;
          object.eventList = object.eventList.filter(
            (e) => key(e.collisionObjectId?.path ?? '') !== key(id.path),
          );
          const file =
            object.eventList.length < before &&
            (await findCaseInsensitive(other.dir, `Collision_${id.name}.gml`));
          if (file) tx.deleteOnCommit(file);
        } else if (other.isKind('rooms')) {
          const room = yy as YyRoom;
          const removed = new Set<string>();
          for (const layer of instanceLayers(room)) {
            layer.instances = layer.instances.filter((i) => {
              if (key(i.objectId.path) !== key(id.path)) return true;
              removed.add(i.name);
              return false;
            });
          }
          room.instanceCreationOrder = room.instanceCreationOrder.filter(
            (i) => !removed.has(i.name),
          );
          for (const name of removed) {
            await this.deleteInstanceCreationCode(tx, other, name);
          }
        }
        tx.stageYy(other.yyPath, other.kind, yy as any);
        if (referencesPath(yy, id.path)) danglingReferences.push(other.name);
      }
      tx.deleteOnCommit(asset.dir);
      return { danglingReferences };
    });
  }

  // --- Objects ---

  /** Set (or unset) an object's parent */
  async setObjectParent(
    object: AssetRef<'objects'>,
    parent: AssetRef<'objects'> | undefined,
  ): Promise<void> {
    const obj = this.requireAsset(object, 'objects');
    const newParent = parent ? this.requireAsset(parent, 'objects') : undefined;
    if (newParent) {
      assert(
        newParent !== obj && !this.getAncestors(newParent).includes(obj),
        `Cannot make "${newParent.name}" the parent of "${obj.name}": that would create a cycle`,
      );
    }
    await this.updateYy(obj, (yy) => {
      yy.parentObjectId = newParent ? { ...newParent.id } : null;
    });
  }

  /** Set (or unset) an object's sprite */
  async setObjectSprite(
    object: AssetRef<'objects'>,
    sprite: AssetRef<'sprites'> | undefined,
  ): Promise<void> {
    const obj = this.requireAsset(object, 'objects');
    const newSprite = sprite ? this.requireAsset(sprite, 'sprites') : undefined;
    await this.updateYy(obj, (yy) => {
      yy.spriteId = newSprite ? { ...newSprite.id } : null;
    });
  }

  /**
   * Add an event to an object, creating its GML file if needed. Returns the
   * path to the event's GML file.
   * @param event The event, or its file name (`Step_0`) or label (`Step`).
   */
  async createObjectEvent(
    object: AssetRef<'objects'>,
    event: ObjectEvent | string,
  ): Promise<string> {
    const obj = this.requireAsset(object, 'objects');
    const info = resolveEvent(event);
    const collisionWith = info.collisionObject
      ? this.requireAsset(info.collisionObject, 'objects')
      : undefined;
    return await this.transaction(async (tx) => {
      const yy = await tx.yy(obj);
      const file =
        (await findCaseInsensitive(obj.dir, `${info.name}.gml`)) ||
        path.join(obj.dir, `${info.name}.gml`);
      if (!yy.eventList.some((e) => isSameEvent(e, info))) {
        yy.eventList.push(
          yyObjectEventSchema.parse({
            eventType: info.eventType,
            eventNum: info.eventNum,
            collisionObjectId: collisionWith ? { ...collisionWith.id } : null,
          }),
        );
        tx.stageYy(obj.yyPath, obj.kind, yy);
      }
      if (!(await exists(file))) await tx.writeFile(file, '');
      return file;
    });
  }

  /** Remove an event from an object, deleting its GML file */
  async deleteObjectEvent(
    object: AssetRef<'objects'>,
    event: ObjectEvent | string,
  ): Promise<void> {
    const obj = this.requireAsset(object, 'objects');
    const info = resolveEvent(event);
    await this.transaction(async (tx) => {
      const yy = await tx.yy(obj);
      yy.eventList = yy.eventList.filter((e) => !isSameEvent(e, info));
      tx.stageYy(obj.yyPath, obj.kind, yy);
      const file = await findCaseInsensitive(obj.dir, `${info.name}.gml`);
      if (file) tx.deleteOnCommit(file);
    });
  }

  // --- Rooms ---

  /**
   * Add an instance of an object to a room, at the end of the creation
   * order. Returns the new instance's ID.
   * @param options.layer The instance layer to add it to (default: the first one, created if needed)
   */
  async addRoomInstance(
    room: AssetRef<'rooms'>,
    object: AssetRef<'objects'>,
    options?: { x?: number; y?: number; layer?: string },
  ): Promise<string> {
    const target = this.requireAsset(room, 'rooms');
    const obj = this.requireAsset(object, 'objects');
    return await this.transaction(async (tx) => {
      const yy = await tx.yy(target);
      const layers = instanceLayers(yy);
      let layer = options?.layer
        ? layers.find((l) => key(l.name) === key(options.layer!))
        : layers[0];
      if (!layer) {
        layer = yyRoomInstanceLayerSchema.parse(
          options?.layer ? { name: options.layer } : {},
        );
        yy.layers.unshift(layer);
      }
      const instance = yyRoomInstanceSchema.parse({
        objectId: { ...obj.id },
        x: options?.x ?? 0,
        y: options?.y ?? 0,
      });
      layer.instances.push(instance);
      yy.instanceCreationOrder.push({
        name: instance.name,
        path: target.id.path,
      });
      tx.stageYy(target.yyPath, target.kind, yy);
      return instance.name;
    });
  }

  /** Remove an instance from a room (and its creation code, if any) */
  async removeRoomInstance(
    room: AssetRef<'rooms'>,
    instanceId: string,
  ): Promise<void> {
    const target = this.requireAsset(room, 'rooms');
    await this.transaction(async (tx) => {
      const yy = await tx.yy(target);
      for (const layer of instanceLayers(yy)) {
        layer.instances = layer.instances.filter((i) => i.name !== instanceId);
      }
      yy.instanceCreationOrder = yy.instanceCreationOrder.filter(
        (i) => i.name !== instanceId,
      );
      tx.stageYy(target.yyPath, target.kind, yy);
      await this.deleteInstanceCreationCode(tx, target, instanceId);
    });
  }

  /** Set a room's instance creation order. Must list every instance exactly once. */
  async reorderRoomInstances(
    room: AssetRef<'rooms'>,
    instanceIds: string[],
  ): Promise<void> {
    const target = this.requireAsset(room, 'rooms');
    await this.transaction(async (tx) => {
      const yy = await tx.yy(target);
      const current = new Set(yy.instanceCreationOrder.map((i) => i.name));
      const requested = new Set(instanceIds);
      assert(
        requested.size === instanceIds.length,
        'Instance IDs must be unique',
      );
      assert(
        requested.size === current.size &&
          instanceIds.every((i) => current.has(i)),
        'The new order must list every instance in the room',
      );
      yy.instanceCreationOrder = instanceIds.map((name) => ({
        name,
        path: target.id.path,
      }));
      tx.stageYy(target.yyPath, target.kind, yy);
    });
  }

  // --- Sprites ---

  /** Add PNG images as new frames at the end of a (non-Spine) sprite */
  async addSpriteFrames(
    sprite: AssetRef<'sprites'>,
    images: string[],
  ): Promise<void> {
    const target = this.requireSpriteForFrames(sprite);
    if (!images.length) return;
    const sizes = await Promise.all(images.map((i) => getPngSize(i)));
    await this.transaction(async (tx) => {
      let yy = await tx.yy(target);
      const expected = yy.frames.length
        ? { width: yy.width, height: yy.height }
        : sizes[0];
      assert(
        sizes.every(
          (s) => s.width === expected.width && s.height === expected.height,
        ),
        `All frames must be ${expected.width}x${expected.height}`,
      );
      const start = yy.frames.length;
      yy.frames.push(...images.map(() => ({}) as YySprite['frames'][number]));
      yy = yySpriteSchema.parse({ ...yy, ...expected });
      for (const [i, image] of images.entries()) {
        const frameId = yy.frames[start + i].name;
        await tx.copyFile(image, path.join(target.dir, `${frameId}.png`));
      }
      tx.stageYy(target.yyPath, target.kind, yy);
    });
  }

  /** Delete frames from a (non-Spine) sprite, along with their images */
  async deleteSpriteFrames(
    sprite: AssetRef<'sprites'>,
    frameIds: string[],
  ): Promise<void> {
    const target = this.requireSpriteForFrames(sprite);
    const remaining = target.frameIds.filter((id) => !frameIds.includes(id));
    await this.reorderSpriteFrames(target, remaining);
  }

  /**
   * Set the order of a (non-Spine) sprite's frames. Frames not listed are
   * deleted, along with their images.
   */
  async reorderSpriteFrames(
    sprite: AssetRef<'sprites'>,
    frameIds: string[],
  ): Promise<void> {
    const target = this.requireSpriteForFrames(sprite);
    await this.transaction(async (tx) => {
      const yy = await tx.yy(target);
      const byId = new Map(yy.frames.map((f) => [f.name, f]));
      assert(
        frameIds.every((id) => byId.has(id)),
        "Can't reorder frames that don't exist",
      );
      assert(
        new Set(frameIds).size === frameIds.length,
        'Frame IDs must be unique',
      );
      const removed = yy.frames.filter((f) => !frameIds.includes(f.name));
      yy.frames = frameIds.map((id) => byId.get(id)!);
      tx.stageYy(target.yyPath, target.kind, yySpriteSchema.parse(yy));
      for (const frame of removed) {
        tx.deleteOnCommit(path.join(target.dir, `${frame.name}.png`));
        tx.deleteOnCommit(path.join(target.dir, 'layers', frame.name));
      }
    });
  }

  // --- Helpers ---

  /**
   * Change an asset's yy data, in a transaction. `change` gets the data as
   * read fresh from disk, and mutates it.
   */
  async updateYy<K extends AssetKind>(
    asset: Asset<K>,
    change: (yy: YyData<K>) => void,
  ): Promise<void> {
    await this.transaction(async (tx) => {
      const yy = await tx.yy(asset);
      change(yy);
      tx.stageYy(asset.yyPath, asset.kind, yy);
    });
  }

  protected requireSpriteForFrames(sprite: AssetRef<'sprites'>) {
    const target = this.requireAsset(sprite, 'sprites');
    assert(
      !target.isSpineSprite,
      `"${target.name}" is a Spine sprite, so its frames can't be edited`,
    );
    return target;
  }

  /** Split an asset-tree path into the asset name and its folder */
  protected parseNewAssetPath(assetPath: string): {
    name: string;
    folder: string[];
  } {
    const parts = splitPath(assetPath);
    const name = parts.pop();
    assert(name, `No asset name in path "${assetPath}"`);
    assertIsValidIdentifier(name);
    assert(!this.getAsset(name), `An asset named "${name}" already exists`);
    return { name, folder: parts };
  }

  /** Throw if the name is taken (checking disk, not just memory) */
  protected async assertNameAvailable(
    tx: ProjectTransaction,
    name: string,
    kind: AssetKind,
  ): Promise<void> {
    assert(!this.getAsset(name), `An asset named "${name}" already exists`);
    const yyp = await tx.yyp();
    assert(
      !yyp.resources.some((r) => key(r.id.name) === key(name)),
      `An asset named "${name}" already exists`,
    );
    const dir = await findCaseInsensitive(path.join(this.dir, kind), name);
    assert(
      !dir || !(await listDir(dir)).length,
      `The folder for "${name}" already exists and isn't empty: ${dir}`,
    );
  }

  /**
   * Create a new asset: `build` writes any extra files and returns the yy
   * data, which is then written and added to the yyp.
   */
  protected async createAsset<K extends AssetKind>(
    kind: K,
    name: string,
    build: (tx: ProjectTransaction, dir: string) => Promise<unknown>,
  ): Promise<Asset<K>> {
    await this.transaction(async (tx) => {
      await this.assertNameAvailable(tx, name, kind);
      const id = assetId(kind, name);
      const dir = path.join(this.dir, kind, name);
      tx.onRollback(() => fs.rm(dir, { recursive: true, force: true }));
      const yy = (await build(tx, dir)) as YyData<K>;
      tx.stageYy(path.join(this.dir, id.path), kind, yy);
      const yyp = await tx.yyp();
      yyp.resources.push({ id });
      if (kind === 'rooms') yyp.RoomOrderNodes.push({ roomId: { ...id } });
    });
    return this.requireAsset(name, kind);
  }

  protected async deleteInstanceCreationCode(
    tx: ProjectTransaction,
    room: Asset,
    instanceId: string,
  ) {
    const file = await findCaseInsensitive(
      room.dir,
      `InstanceCreationCode_${instanceId}.gml`,
    );
    if (file) tx.deleteOnCommit(file);
  }

  /**
   * Give a room's instances new IDs (instance IDs must be unique across the
   * project), renaming their creation-code files to match.
   */
  protected async renewRoomInstanceIds(
    tx: ProjectTransaction,
    room: YyRoom,
    dir: string,
  ) {
    const renamed = new Map<string, string>();
    for (const layer of instanceLayers(room)) {
      for (const instance of layer.instances) {
        const newId = `inst_${randomBytes(4).toString('hex').toUpperCase()}`;
        renamed.set(instance.name, newId);
        instance.name = newId;
      }
    }
    for (const entry of room.instanceCreationOrder) {
      entry.name = renamed.get(entry.name) ?? entry.name;
    }
    for (const [oldId, newId] of renamed) {
      const file = await findCaseInsensitive(
        dir,
        `InstanceCreationCode_${oldId}.gml`,
      );
      if (file) {
        await tx.rename(
          file,
          path.join(dir, `InstanceCreationCode_${newId}.gml`),
        );
      }
    }
  }
}

function assetId(kind: AssetKind, name: string): YypResourceId {
  return { name, path: `${kind}/${name}/${name}.yy` };
}

function isSameOrSubfolder(folderPathYy: string, posix: string): boolean {
  const k = key(folderPathYy);
  return (
    k === key(folderPathToYy(posix)) || k.startsWith(key(`folders/${posix}/`))
  );
}

function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * A function that renames the parts of a relative path that are named after
 * an asset (e.g. `obj_old.yy`, `snd_old.wav`, `Collision_obj_old.gml`).
 */
function fileRenamer(from: string, to: string): (relative: string) => string {
  const pattern = new RegExp(
    `(?<![a-zA-Z0-9])${escapeRegex(from)}(?![a-zA-Z0-9_])`,
    'gi',
  );
  return (relative) => relative.replace(pattern, to);
}

/** Update an asset's own yy data for a new name */
function renameInOwnYy(
  yy: Record<string, any>,
  kind: AssetKind,
  from: YypResourceId,
  to: YypResourceId,
  renamer: (relative: string) => string,
) {
  replaceRefs(yy, from, to);
  yy.name = to.name;
  if ('%Name' in yy) yy['%Name'] = to.name;
  if (kind === 'sounds' && typeof yy.soundFile === 'string') {
    yy.soundFile = renamer(yy.soundFile);
  }
  if (kind === 'sprites' && yy.sequence && typeof yy.sequence === 'object') {
    yy.sequence.name = to.name;
    if ('%Name' in yy.sequence) yy.sequence['%Name'] = to.name;
  }
}

function resolveEvent(event: ObjectEvent | string): ObjectEvent {
  if (typeof event !== 'string') return event;
  const info = getEventFromFilename(event) || getEventFromLabel(event);
  assert(info, `Unknown object event: ${event}`);
  return info;
}

function isSameEvent(
  entry: YyObject['eventList'][number],
  event: ObjectEvent,
): boolean {
  const info = getEvent(
    entry.eventType,
    entry.eventNum,
    entry.collisionObjectId?.name,
  );
  return !!info && key(info.name) === key(event.name);
}
