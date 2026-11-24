import type {
  YyData,
  YyObject,
  YyResourceType,
  YyRoom,
  YyRoomInstanceLayer,
  YySound,
  YySprite,
  YypResourceId,
} from '@bscotch/yy';
import path from 'node:path';
import { getEvent, type ObjectEvent } from './objectEvents.ts';
import { folderPathToPosix, key } from './util.ts';

export type AssetKind = YyResourceType;

/** A reference to an asset: the asset itself, or its name (case-insensitive) */
export type AssetRef<K extends AssetKind = AssetKind> = Asset<K> | string;

export interface ObjectEventFile {
  event: ObjectEvent;
  /** Absolute path to the event's GML file */
  file: string;
}

export interface RoomInstanceInfo {
  /** The instance's unique name (e.g. `inst_1A2B3C4D`) */
  instanceId: string;
  objectName: string;
  layerName: string;
  x: number;
  y: number;
  /** The path to the instance's creation code, if it has any */
  creationCodeFile?: string;
}

/** @internal Everything needed to construct an {@link Asset} */
export interface AssetInit<K extends AssetKind> {
  kind: K;
  id: YypResourceId;
  yyPath: string;
  yy: YyData<K>;
  yyHash: string;
  /** The names of the files in the asset's directory */
  dirEntries: string[];
}

/**
 * A GameMaker asset ("resource"): its yy data and the files that belong to it.
 *
 * An `Asset` is a read-only view of what is on disk. To change an asset, use
 * the methods on {@link GameMakerProject}, which write to disk and then update
 * the `Asset` (emitting events). Do not mutate {@link yy} directly.
 *
 * An asset keeps the same identity (`===`) for its whole life, even as its
 * data changes. Renaming an asset replaces it with a new one.
 */
export class Asset<K extends AssetKind = AssetKind> {
  readonly kind: K;
  /** The yyp resource id, e.g. `{name: 'obj_player', path: 'objects/obj_player/obj_player.yy'}` */
  readonly id: Readonly<YypResourceId>;
  /** Absolute path to the asset's yy file */
  readonly yyPath: string;
  protected _yy!: YyData<K>;
  protected _yyHash!: string;
  protected _gmlFiles: string[] = [];
  protected _orphanedGmlFiles: string[] = [];

  /** @internal Use the project's methods to get assets */
  constructor(init: AssetInit<K>) {
    this.kind = init.kind;
    this.id = Object.freeze({ ...init.id });
    this.yyPath = init.yyPath;
    this.update(init);
  }

  /** @internal Replace the asset's data with what is now on disk */
  update(init: Pick<AssetInit<K>, 'yy' | 'yyHash' | 'dirEntries'>) {
    this._yy = init.yy;
    this._yyHash = init.yyHash;
    this.updateGmlFiles(init.dirEntries);
  }

  /** @internal Recompute which GML files belong to this asset */
  updateGmlFiles(dirEntries: string[]) {
    const gml = dirEntries.filter((e) => e.toLowerCase().endsWith('.gml'));
    const files: string[] = [];
    if (this.kind === 'scripts') {
      const match =
        gml.find((e) => e === `${this.name}.gml`) ||
        gml.find((e) => key(e) === key(`${this.name}.gml`));
      if (match) files.push(match);
    } else if (this.kind === 'objects') {
      for (const { event } of this.listEvents()) {
        const match =
          gml.find((e) => e === `${event.name}.gml`) ||
          gml.find((e) => key(e) === key(`${event.name}.gml`));
        if (match) files.push(match);
      }
    } else if (this.kind === 'rooms') {
      // Room creation code, then instance creation code (in creation order)
      const wanted = [
        this.roomCreationCodeFile,
        ...this.roomInstances.map((i) => i.creationCodeFile),
      ];
      for (const file of wanted) {
        if (!file) continue;
        const name = path.basename(file);
        const match =
          gml.find((e) => e === name) || gml.find((e) => key(e) === key(name));
        if (match) files.push(match);
      }
    }
    const used = new Set(files);
    this._gmlFiles = files.map((f) => path.join(this.dir, f));
    this._orphanedGmlFiles = gml
      .filter((f) => !used.has(f))
      .map((f) => path.join(this.dir, f));
  }

  /** @internal A hash of the yy file's content, for change detection */
  get yyHash(): string {
    return this._yyHash;
  }

  /** The asset's yy data, as read from disk. Do not mutate! */
  get yy(): YyData<K> {
    return this._yy;
  }

  get name(): string {
    return this.id.name;
  }

  /** Absolute path to the asset's directory */
  get dir(): string {
    return path.dirname(this.yyPath);
  }

  /** The asset's folder in the IDE's asset tree, in POSIX form (`my/folder`) */
  get folder(): string {
    const parent = (this._yy as { parent?: { path?: string } }).parent;
    // Assets at the root have the project as their parent
    if (!parent?.path || parent.path.toLowerCase().endsWith('.yyp')) return '';
    return folderPathToPosix(parent.path);
  }

  /** Whether this asset is in the given folder, or one of its subfolders */
  isInFolder(folder: string): boolean {
    folder = key(folderPathToPosix(folder));
    const current = key(this.folder);
    return current === folder || current.startsWith(`${folder}/`);
  }

  /**
   * Absolute paths to the GML files that belong to this asset: a script's
   * file, an object's event files (Create first, then in event order), or a
   * room's creation code files. Only files GameMaker would use are included.
   */
  get gmlFiles(): readonly string[] {
    return this._gmlFiles;
  }

  /**
   * GML files in the asset's directory that GameMaker would ignore (e.g. the
   * file for an event that has been removed from the object).
   */
  get orphanedGmlFiles(): readonly string[] {
    return this._orphanedGmlFiles;
  }

  isKind<T extends AssetKind>(kind: T): this is Asset<T> {
    return (this.kind as AssetKind) === kind;
  }

  // --- Objects ---

  /** For objects, the name of the parent object */
  get parentName(): string | undefined {
    if (!this.isKind('objects')) return undefined;
    return (this._yy as YyObject).parentObjectId?.name || undefined;
  }

  /** For objects, the name of the sprite */
  get spriteName(): string | undefined {
    if (!this.isKind('objects')) return undefined;
    return (this._yy as YyObject).spriteId?.name || undefined;
  }

  /** For objects, the events listed in the yy file, with their file names */
  listEvents(): ObjectEventFile[] {
    if (!this.isKind('objects')) return [];
    const events: ObjectEventFile[] = [];
    for (const entry of (this._yy as YyObject).eventList || []) {
      const event = getEvent(
        entry.eventType,
        entry.eventNum,
        entry.collisionObjectId?.name,
      );
      if (!event) continue;
      events.push({ event, file: path.join(this.dir, `${event.name}.gml`) });
    }
    // Create first, then in a stable order
    return events.sort((a, b) => {
      const aCreate = a.event.eventType === 0 ? 0 : 1;
      const bCreate = b.event.eventType === 0 ? 0 : 1;
      return (
        aCreate - bCreate ||
        a.event.eventType - b.event.eventType ||
        a.event.eventNum - b.event.eventNum ||
        a.event.name.localeCompare(b.event.name)
      );
    });
  }

  /** For objects, the GML file for an event, by file name (e.g. `Step_0`) */
  getEventFile(eventName: string): string | undefined {
    eventName = key(eventName.replace(/\.gml$/i, ''));
    return this._gmlFiles.find(
      (f) => key(path.basename(f, path.extname(f))) === eventName,
    );
  }

  // --- Rooms ---

  /** For rooms, the object instances, in creation order */
  get roomInstances(): RoomInstanceInfo[] {
    if (!this.isKind('rooms')) return [];
    const yy = this._yy as YyRoom;
    const instances = new Map<string, RoomInstanceInfo>();
    for (const layer of instanceLayers(yy)) {
      for (const instance of layer.instances || []) {
        instances.set(instance.name, {
          instanceId: instance.name,
          objectName: instance.objectId.name,
          layerName: layer.name,
          x: instance.x,
          y: instance.y,
          creationCodeFile: instance.hasCreationCode
            ? path.join(this.dir, `InstanceCreationCode_${instance.name}.gml`)
            : undefined,
        });
      }
    }
    const ordered: RoomInstanceInfo[] = [];
    for (const { name } of yy.instanceCreationOrder || []) {
      const instance = instances.get(name);
      if (instance) ordered.push(instance);
    }
    return ordered;
  }

  /** For rooms, the path to the room's creation code, if it has any */
  get roomCreationCodeFile(): string | undefined {
    if (!this.isKind('rooms')) return undefined;
    const file = (this._yy as YyRoom).creationCodeFile;
    return file ? path.join(this.dir, path.basename(file)) : undefined;
  }

  // --- Sprites ---

  get isSpineSprite(): boolean {
    return this.isKind('sprites') && (this._yy as YySprite).type === 2;
  }

  /** For sprites, the frame IDs, in order */
  get frameIds(): string[] {
    if (!this.isKind('sprites')) return [];
    return ((this._yy as YySprite).frames || []).map((f) => f.name);
  }

  /** For non-Spine sprites, the frame image paths, in order */
  get framePaths(): string[] {
    if (this.isSpineSprite) return [];
    return this.frameIds.map((id) => path.join(this.dir, `${id}.png`));
  }

  /** For Spine sprites, the paths to the Spine files */
  get spinePaths(): { json: string; atlas: string } | undefined {
    const frameId = this.isSpineSprite ? this.frameIds[0] : undefined;
    if (!frameId) return undefined;
    return {
      json: path.join(this.dir, `${frameId}.json`),
      atlas: path.join(this.dir, `${frameId}.atlas`),
    };
  }

  // --- Sounds & Shaders ---

  /** For sounds, the path to the audio file */
  get soundFile(): string | undefined {
    if (!this.isKind('sounds')) return undefined;
    const file = (this._yy as YySound).soundFile;
    return file ? path.join(this.dir, file) : undefined;
  }

  /** For shaders, the paths to the shader source files */
  get shaderPaths(): { vertex: string; fragment: string } | undefined {
    if (!this.isKind('shaders')) return undefined;
    const base = this.yyPath.replace(/\.yy$/i, '');
    return { vertex: `${base}.vsh`, fragment: `${base}.fsh` };
  }
}

/**
 * List a room's instance layers, including those nested in layer folders.
 */
export function instanceLayers(room: YyRoom): YyRoomInstanceLayer[] {
  const found: YyRoomInstanceLayer[] = [];
  const visit = (layers: unknown[] | null | undefined) => {
    for (const layer of layers || []) {
      if (!layer || typeof layer !== 'object') continue;
      const l = layer as { resourceType?: string; layers?: unknown[] };
      if (l.resourceType === 'GMRInstanceLayer') {
        found.push(layer as YyRoomInstanceLayer);
      }
      visit(l.layers);
    }
  };
  visit(room.layers);
  return found;
}
