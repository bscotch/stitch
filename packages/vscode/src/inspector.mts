import type { Asset } from '@bscotch/gamemaker-project';
import vscode from 'vscode';
import { stitchEvents } from './events.mjs';
import type { StitchWorkspace } from './extension.workspace.mjs';
import { createSorter } from './lib.mjs';
import { logger } from './log.mjs';
import { StitchTreeItemBase } from './tree.base.mjs';
import { assetMainFile, TreeCode } from './tree.items.mjs';
export type { ObjectParentFolder };

type InspectorItem =
  | ObjectItem
  | ObjectParentFolder
  | ObjectChildren
  | ObjectEvents
  | TreeCode
  | ObjectSpriteItem
  | ObjectSpriteFolder;

class ObjectParentFolder extends StitchTreeItemBase<'inspector-object-parents'> {
  override readonly kind = 'inspector-object-parents';
  parent = undefined;
  constructor(readonly asset: Asset<'objects'>) {
    super('Parent');
    this.contextValue = this.kind;
    this.collapsibleState = vscode.TreeItemCollapsibleState.Expanded;
  }
}

class ObjectChildren extends StitchTreeItemBase<'inspector-object-children'> {
  override readonly kind = 'inspector-object-children';
  parent = undefined;
  constructor(totalChildren: number) {
    super('Children');
    this.contextValue = this.kind;
    this.description = totalChildren > 0 ? `${totalChildren}` : '(none)';
    this.collapsibleState =
      totalChildren > 0
        ? vscode.TreeItemCollapsibleState.Expanded
        : vscode.TreeItemCollapsibleState.None;
  }
}

class ObjectItem extends StitchTreeItemBase<'asset-objects'> {
  override readonly kind = 'asset-objects';
  parent = undefined;

  constructor(
    readonly asset: Asset<'objects'>,
    readonly listing: 'children' | 'parents',
    hasEntries: boolean,
  ) {
    super(asset.name);
    this.contextValue = this.kind;
    this.setBaseIcon('symbol-misc');
    this.collapsibleState = hasEntries
      ? vscode.TreeItemCollapsibleState.Collapsed
      : vscode.TreeItemCollapsibleState.None;
    this.command = {
      command: 'vscode.open',
      title: 'Open',
      arguments: [vscode.Uri.file(assetMainFile(asset))],
    };
  }
}

class ObjectEvents extends StitchTreeItemBase<'inspector-object-events'> {
  override readonly kind = 'inspector-object-events';
  parent = undefined;
  constructor(readonly asset: Asset<'objects'>) {
    super('Events');
    this.contextValue = this.kind;
    this.collapsibleState = vscode.TreeItemCollapsibleState.Expanded;
  }
}

export class ObjectSpriteFolder extends StitchTreeItemBase<'inspector-object-sprites'> {
  override readonly kind = 'inspector-object-sprites';
  parent = undefined;
  constructor(readonly asset: Asset<'objects'>) {
    super('Sprite');
    this.contextValue = this.kind;
    this.collapsibleState = vscode.TreeItemCollapsibleState.Expanded;
  }
}

export class ObjectSpriteItem extends StitchTreeItemBase<'asset-sprites'> {
  override readonly kind = 'asset-sprites';
  parent = undefined;

  constructor(readonly asset: Asset<'sprites'>) {
    super(asset.name);
    this.contextValue = this.kind;

    this.command = {
      command: 'stitch.assets.editSprite',
      title: 'Edit Sprite',
      arguments: [this],
    };

    this.setIcon();
  }

  setIcon() {
    const frame = this.asset.framePaths[0];
    if (frame) {
      this.iconPath = vscode.Uri.file(frame);
    } else {
      this.setGameMakerIcon('sprites');
    }
  }
}

/** Details of the object whose file is open: its parent, sprite, events and children */
export class GameMakerInspectorProvider implements vscode.TreeDataProvider<InspectorItem> {
  asset: Asset<'objects'> | undefined;
  view!: vscode.TreeView<InspectorItem>;
  private _onDidChangeTreeData: vscode.EventEmitter<
    InspectorItem | undefined | null | void
  > = new vscode.EventEmitter<InspectorItem | undefined | null | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  constructor(readonly workspace: StitchWorkspace) {}

  protected get gm() {
    return this.asset
      ? this.workspace.getProjectOfAsset(this.asset)?.gm
      : undefined;
  }

  getTreeItem(element: InspectorItem): vscode.TreeItem {
    return element;
  }

  protected objectItem(
    asset: Asset<'objects'>,
    listing: 'children' | 'parents',
  ) {
    const gm = this.gm;
    const hasEntries =
      listing === 'children'
        ? !!gm?.getChildren(asset).length
        : !!asset.parentName;
    return new ObjectItem(asset, listing, hasEntries);
  }

  protected childrenOf(asset: Asset<'objects'>): ObjectItem[] {
    return (this.gm?.getChildren(asset) ?? [])
      .sort(createSorter({ sortByField: 'name' }))
      .map((child) => this.objectItem(child, 'children'));
  }

  getChildren(
    element?: InspectorItem | undefined,
  ): InspectorItem[] | undefined {
    const asset = this.asset;
    const gm = this.gm;
    if (!asset || !gm) {
      return;
    }
    if (!element) {
      return [
        new ObjectParentFolder(asset),
        new ObjectSpriteFolder(asset),
        new ObjectEvents(asset),
        new ObjectChildren(gm.getChildren(asset).length),
      ];
    } else if (element instanceof ObjectParentFolder) {
      const parent = gm.getParent(asset);
      return parent ? [this.objectItem(parent, 'parents')] : [];
    } else if (element instanceof ObjectSpriteFolder) {
      const sprite = gm.getAsset(asset.spriteName);
      return sprite?.isKind('sprites') ? [new ObjectSpriteItem(sprite)] : [];
    } else if (element instanceof ObjectEvents) {
      return TreeCode.listFor(asset);
    } else if (element instanceof ObjectChildren) {
      return this.childrenOf(asset);
    } else if (element instanceof ObjectItem) {
      if (element.listing === 'children') {
        return this.childrenOf(element.asset);
      }
      const parent = gm.getParent(element.asset);
      return parent ? [this.objectItem(parent, 'parents')] : [];
    }
    return;
  }

  /** Show the object whose file is in the active editor (if it's an object) */
  rebuild(force = false) {
    const currentAsset = this.workspace.getCurrentAsset();
    if (!currentAsset?.isKind('objects')) {
      if (force) this._onDidChangeTreeData.fire();
      return;
    }
    this.asset = currentAsset;
    logger.info('Rebuilding inspector tree', this.asset.name);
    this._onDidChangeTreeData.fire();
    this.view.title = `Inspector: ${this.asset.name}`;
  }

  register(): vscode.Disposable[] {
    this.view = vscode.window.createTreeView('bscotch-stitch-inspector', {
      treeDataProvider: this,
    });
    const activeEditorMonitor = vscode.window.onDidChangeActiveTextEditor(() =>
      this.rebuild(),
    );

    this.rebuild();

    // Keep up with changes to the project
    stitchEvents.on('asset-changed', (asset) => {
      if (!this.asset) return;
      // (The object itself, or a related object or sprite)
      if (
        asset === this.asset ||
        asset.name === this.asset.spriteName ||
        asset.isKind('objects')
      ) {
        this._onDidChangeTreeData.fire();
      }
    });
    stitchEvents.on('project-changed', () => {
      // The object may have been deleted or renamed
      if (this.asset && !this.gm?.getAsset(this.asset.name)) {
        this.asset = undefined;
        this.view.title = 'Inspector';
      }
      this._onDidChangeTreeData.fire();
    });

    return [this.view, activeEditorMonitor];
  }
}
