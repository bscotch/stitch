import {
  Asset,
  Code,
  getEventFromFilename,
  isAssetOfKind,
} from '@bscotch/gml-parser';
import vscode from 'vscode';
import { stitchEvents } from './events.mjs';
import type { StitchWorkspace } from './extension.workspace.mjs';
import { createSorter, uriFromPathy } from './lib.mjs';
import { logger } from './log.mjs';
import { StitchTreeItemBase, setEventIcon } from './tree.base.mjs';
export type { ObjectParentFolder };

type InspectorItem =
  | ObjectItem
  | ObjectParentFolder
  | ObjectChildren
  | ObjectEvents
  | ObjectEventItem
  | ObjectSpriteItem
  | ObjectSpriteFolder;

class ObjectParentFolder extends StitchTreeItemBase<'inspector-object-parents'> {
  override readonly kind = 'inspector-object-parents';
  parent = undefined;
  constructor(
    readonly asset: Asset<'objects'>,
    readonly provider: GameMakerInspectorProvider,
  ) {
    super('Parent');
    this.contextValue = this.kind;
    this.collapsibleState = vscode.TreeItemCollapsibleState.Expanded;
  }

  onSetParent(parent: Asset<'objects'> | undefined) {
    this.provider.onUpdate(this);
  }

  onSetSprite(sprite: Asset<'sprites'> | undefined) {
    this.provider.onUpdate(this);
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
  ) {
    super(asset.name);
    this.contextValue = this.kind;
    this.setBaseIcon('symbol-misc');

    const hasEntries =
      (listing === 'children' && asset.children.length > 0) ||
      (listing === 'parents' && asset.parent);
    this.collapsibleState = hasEntries
      ? vscode.TreeItemCollapsibleState.Collapsed
      : vscode.TreeItemCollapsibleState.None;

    this.command = {
      command: 'vscode.open',
      title: 'Open',
      arguments: [uriFromPathy(asset.gmlFile?.path || asset.yyPath)],
    };
  }
}

class ObjectEvents extends StitchTreeItemBase<'inspector-object-events'> {
  override readonly kind = 'inspector-object-events';
  parent = undefined;
  constructor(
    readonly asset: Asset<'objects'>,
    readonly provider: GameMakerInspectorProvider,
  ) {
    super('Events');
    this.contextValue = this.kind;
    this.collapsibleState = vscode.TreeItemCollapsibleState.Expanded;
  }

  // To be called by the stitch.assets.newEvent command registered by the TreeProvider.
  onCreateEvent() {
    this.provider.onUpdate(this);
    this.provider.view.reveal(this, { expand: true });
  }
}

class ObjectEventItem extends StitchTreeItemBase<'code'> {
  override readonly kind = 'code';
  parent = undefined;

  constructor(readonly code: Code) {
    super(code.name);
    this.contextValue = this.kind;

    this.collapsibleState = vscode.TreeItemCollapsibleState.None;
    this.command = {
      command: 'vscode.open',
      title: 'Open',
      arguments: [uriFromPathy(code.path)],
    };
    this.setIcon();

    // Ensure that the tree label is human-friendly.
    this.label = getEventFromFilename(code.path.absolute);
  }

  protected setIcon = setEventIcon;
}

class ObjectSpriteFolder extends StitchTreeItemBase<'inspector-object-sprites'> {
  override readonly kind = 'inspector-object-sprites';
  parent = undefined;
  constructor() {
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
    const frame = this.asset.framePaths?.[0];
    if (frame) {
      this.iconPath = vscode.Uri.file(frame.absolute);
    } else {
      this.setGameMakerIcon('sprite');
    }
    this.command = {
      command: 'stitch.assets.editSprite',
      title: 'Edit Sprite',
      arguments: [this],
    };
  }
}

export class GameMakerInspectorProvider
  implements vscode.TreeDataProvider<InspectorItem>
{
  asset: Asset<'objects'> | undefined;
  view!: vscode.TreeView<InspectorItem>;
  private _onDidChangeTreeData: vscode.EventEmitter<
    InspectorItem | undefined | null | void
  > = new vscode.EventEmitter<InspectorItem | undefined | null | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private _onDidCollapseElement: vscode.EventEmitter<
    InspectorItem | undefined | null | void
  > = new vscode.EventEmitter<InspectorItem | undefined | null | void>();
  readonly onDidCollapseElement = this._onDidCollapseElement.event;

  constructor(readonly provider: StitchWorkspace) {}

  onUpdate(updated: InspectorItem) {
    this._onDidChangeTreeData.fire(updated);
  }

  getTreeItem(element: InspectorItem): vscode.TreeItem {
    return element;
  }

  getChildren(
    element?: InspectorItem | undefined,
  ): InspectorItem[] | undefined {
    if (!this.asset) {
      return;
    }
    if (!element) {
      // Then we're at the root.
      return [
        new ObjectParentFolder(this.asset, this),
        new ObjectSpriteFolder(),
        new ObjectEvents(this.asset, this),
        new ObjectChildren(this.asset.children.length),
      ];
    } else if (element instanceof ObjectParentFolder && this.asset.parent) {
      return [new ObjectItem(this.asset.parent, 'parents')];
    } else if (element instanceof ObjectSpriteFolder) {
      const sprite = this.asset.sprite;
      if (sprite) {
        return [new ObjectSpriteItem(sprite)];
      }
    } else if (element instanceof ObjectEvents) {
      const events = this.asset.gmlFilesArray.map((code) => {
        return new ObjectEventItem(code);
      });
      return events;
    } else if (element instanceof ObjectChildren) {
      return GameMakerInspectorProvider.getChildrenAsTreeItems(this.asset);
    } else if (element instanceof ObjectItem) {
      if (element.listing === 'children') {
        return GameMakerInspectorProvider.getChildrenAsTreeItems(element.asset);
      } else if (element.asset.parent) {
        return [new ObjectItem(element.asset.parent, 'parents')];
      }
    }
    return;
  }

  static getChildrenAsTreeItems(asset: Asset<'objects'>) {
    return asset.children
      .sort(createSorter({ sortByField: 'name' }))
      .map((child) => {
        return new ObjectItem(child, 'children');
      });
  }

  rebuild() {
    const currentAsset = this.provider.getCurrentAsset();
    if (!currentAsset || !isAssetOfKind(currentAsset, 'objects')) {
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
      showCollapseAll: true,
    });
    const activeEditorMonitor = vscode.window.onDidChangeActiveTextEditor(() =>
      this.rebuild(),
    );

    this.rebuild();

    // Handle emitted events
    stitchEvents.on('asset-deleted', (asset) => {
      if (this.asset === asset) {
        this.asset = undefined;
      }
      // Just always rebuild. It's a rare event, and it's
      // a bit complicated to do this in a sparse way (e.g. we'd
      // need to check parents/children etc)
      this.rebuild();
    });
    stitchEvents.on('code-file-deleted', (code) => {
      if (this.asset === code.asset) {
        this.rebuild();
      }
    });

    // Return subscriptions to owned events and this view
    const subscriptions = [this.view, activeEditorMonitor];
    return subscriptions;
  }
}
