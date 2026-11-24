import type { Asset, AssetKind, ObjectEvent } from '@bscotch/gamemaker-project';
import path from 'node:path';
import vscode from 'vscode';
import { getAssetIcon } from './icons.mjs';
import { StitchTreeItemBase, eventIcon } from './tree.base.mjs';
import { GameMakerFolder } from './tree.folder.mjs';

export type Treeable =
  | TreeAsset
  | TreeCode
  | TreeSpriteFrame
  | TreeRoomInstance
  | TreeShaderFile
  | TreeFilterGroup
  | TreeFilter
  | GameMakerFolder;

// ICONS: See https://code.visualstudio.com/api/references/icons-in-labels#icon-listing

export function isTreeAssetOfKind<K extends AssetKind>(
  item: unknown,
  kind: K,
): item is TreeAsset<K> {
  return item instanceof TreeAsset && item.asset.isKind(kind);
}

/** The file to open for an asset: its main GML file, sound file, etc. */
export function assetMainFile(asset: Asset): string {
  if (asset.isKind('sounds') && asset.soundFile) return asset.soundFile;
  if (asset.isKind('shaders') && asset.shaderPaths) {
    return asset.shaderPaths.fragment;
  }
  return asset.gmlFiles[0] ?? asset.yyPath;
}

export class TreeFilterGroup extends StitchTreeItemBase<'tree-filter-group'> {
  override readonly kind = 'tree-filter-group';
  readonly filters: TreeFilter[] = [];

  constructor(
    readonly parent: GameMakerFolder,
    readonly name: string,
  ) {
    super(`Filter ${name}`);
    this.setBaseIcon('list-filter');

    this.collapsibleState = vscode.TreeItemCollapsibleState.Expanded;
    this.contextValue = this.kind;
  }

  get enabled(): TreeFilter | undefined {
    return this.filters.find((f) => f.enabled);
  }

  addFilter(query: string) {
    const filter = new TreeFilter(this, query);
    this.filters.push(filter);
    this.enable(filter);
    return filter;
  }

  enable(filter: TreeFilter) {
    this.filters.forEach((f) => (f.contextValue = `${f.kind}-disabled`));
    filter.contextValue = `${filter.kind}-enabled`;
  }

  disable(filter: TreeFilter) {
    filter.contextValue = `${filter.kind}-disabled`;
  }
}

export class TreeFilter extends StitchTreeItemBase<'tree-filter'> {
  override readonly kind = 'tree-filter';

  constructor(
    readonly parent: TreeFilterGroup,
    public query: string,
  ) {
    super(query);
    this.collapsibleState = vscode.TreeItemCollapsibleState.None;

    this.command = {
      title: 'Edit',
      command: 'stitch.assets.filters.edit',
      arguments: [this],
      tooltip: 'Edit this filter query',
    };
  }

  get enabled() {
    return this.contextValue!.endsWith('enabled');
  }

  get disabled() {
    return this.contextValue!.endsWith('disabled');
  }

  delete() {
    this.parent.filters.splice(this.parent.filters.indexOf(this), 1);
  }

  enable() {
    this.parent.enable(this);
  }

  disable() {
    this.parent.disable(this);
  }
}

export class TreeAsset<
  T extends AssetKind = AssetKind,
> extends StitchTreeItemBase<'asset'> {
  override readonly kind = 'asset';
  readonly asset: Asset<T>;
  /** Asset:TreeItem lookup, for revealing items and filtering.  */
  static lookup: Map<Asset, TreeAsset> = new Map();

  constructor(
    readonly parent: GameMakerFolder,
    asset: Asset<T>,
  ) {
    super(asset.name);
    this.contextValue = `asset-${asset.kind}`;
    TreeAsset.lookup.set(asset, this);

    this.asset = asset;
    this.refreshTreeItem();
    this.id = this.path;
  }

  get path(): string {
    return this.parent.path + '/' + this.asset.name;
  }

  get project() {
    return this.parent.project;
  }

  refreshTreeItem() {
    const asset = this.asset;
    if (asset.isKind('sprites')) {
      this.command = {
        command: 'stitch.assets.editSprite',
        title: 'Edit Sprite',
        arguments: [this],
      };
    } else {
      this.command = {
        command: 'vscode.open',
        title: 'Open',
        arguments: [vscode.Uri.file(assetMainFile(asset))],
      };
    }

    this.collapsibleState = ['objects', 'sprites', 'shaders', 'rooms'].includes(
      asset.kind,
    )
      ? vscode.TreeItemCollapsibleState.Collapsed
      : vscode.TreeItemCollapsibleState.None;

    this.iconPath = getAssetIcon(asset.kind, asset);
  }
}

/** An object event's GML file */
export class TreeCode extends StitchTreeItemBase<'code'> {
  override readonly kind = 'code';

  constructor(
    readonly parent: TreeAsset | undefined,
    readonly asset: Asset<'objects'>,
    readonly file: string,
    readonly event: ObjectEvent | undefined,
  ) {
    super(event?.label ?? path.basename(file, '.gml'));
    this.contextValue = this.kind;
    this.collapsibleState = vscode.TreeItemCollapsibleState.None;
    this.command = {
      command: 'vscode.open',
      title: 'Open',
      arguments: [this.uri],
    };
    this.iconPath = eventIcon(event?.name ?? path.basename(file, '.gml'));
    this.id = `${parent?.id ?? asset.name}/${path.basename(file)}`;
  }

  get uri() {
    return vscode.Uri.file(this.file);
  }

  /** The event files of an object, as tree items */
  static listFor(asset: Asset<'objects'>, parent?: TreeAsset): TreeCode[] {
    return asset
      .listEvents()
      .map((e) => new TreeCode(parent, asset, e.file, e.event));
  }
}

export class TreeSpriteFrame extends StitchTreeItemBase<'sprite-frame'> {
  override readonly kind = 'sprite-frame';
  constructor(
    readonly parent: TreeAsset<'sprites'>,
    readonly imagePath: string,
    readonly idx: number,
  ) {
    super(`[${idx}] ${path.basename(imagePath, '.png')}`);
    this.contextValue = this.kind;
    this.iconPath = vscode.Uri.file(imagePath);
    this.command = {
      command: 'vscode.open',
      title: 'Open',
      arguments: [this.iconPath],
    };
    this.id = this.parent.id + '/' + path.basename(imagePath);
  }

  get frameId() {
    return path.basename(this.imagePath, '.png');
  }

  get project() {
    return this.parent.project;
  }
}

export class TreeShaderFile extends StitchTreeItemBase<'shader-file'> {
  override readonly kind = 'shader-file';
  constructor(
    readonly parent: TreeAsset,
    readonly path: string,
  ) {
    super(path.endsWith('.vsh') ? 'Vertex' : 'Fragment');
    this.contextValue = this.kind;
    this.command = {
      command: 'vscode.open',
      title: 'Open',
      arguments: [this.uri],
    };
    this.id = this.parent.id + '/' + path.split(/[\\/]/).pop();
    this.setFileIcon('shader');
  }
  get uri() {
    return vscode.Uri.file(this.path);
  }
}

export class TreeRoomInstance extends StitchTreeItemBase<'room-instance'> {
  override readonly kind = 'room-instance';
  constructor(
    readonly parent: TreeAsset<'rooms'>,
    /** The instance's object (if it still exists) */
    readonly asset: Asset<'objects'> | undefined,
    readonly objectName: string,
    readonly instanceId: string,
  ) {
    super(objectName);
    this.contextValue = this.kind;
    this.description = instanceId;
    this.id = this.parent.id + '/' + instanceId;
    if (asset) {
      this.command = {
        command: 'vscode.open',
        title: 'Open',
        arguments: [vscode.Uri.file(assetMainFile(asset))],
      };
      this.iconPath = getAssetIcon(asset.kind, asset);
    } else {
      this.setBaseIcon('warning');
      this.tooltip = `Object "${objectName}" does not exist.`;
    }
  }

  get project() {
    return this.parent.project;
  }
}
