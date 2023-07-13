import {
  Asset,
  Code,
  getEventFromFilename,
  isAssetOfKind,
} from '@bscotch/gml-parser';
import vscode from 'vscode';
import type { StitchProvider } from './extension.provider.mjs';
import { createSorter, uriFromPathy } from './lib.mjs';
import { logger } from './log.mjs';
import { StitchTreeItemBase, setEventIcon } from './tree.base.mjs';

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
  constructor() {
    super('Parent');
    this.contextValue = this.kind;
    this.collapsibleState = vscode.TreeItemCollapsibleState.Expanded;
  }
}

class ObjectChildren extends StitchTreeItemBase<'inspector-object-children'> {
  override readonly kind = 'inspector-object-children';
  parent = undefined;
  constructor() {
    super('Children');
    this.contextValue = this.kind;
    this.collapsibleState = vscode.TreeItemCollapsibleState.Expanded;
  }
}

class ObjectItem extends StitchTreeItemBase<'asset-objects'> {
  override readonly kind = 'asset-objects';
  parent = undefined;

  constructor(readonly asset: Asset<'objects'>) {
    super(asset.name);
    this.contextValue = this.kind;
    this.setBaseIcon('symbol-misc');

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
  constructor() {
    super('Events');
    this.contextValue = this.kind;
    this.collapsibleState = vscode.TreeItemCollapsibleState.Expanded;
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

class ObjectSpriteFolder extends StitchTreeItemBase<'inspector-sprites'> {
  override readonly kind = 'inspector-sprites';
  parent = undefined;
  constructor() {
    super('Sprite');
    this.contextValue = this.kind;
    this.collapsibleState = vscode.TreeItemCollapsibleState.Expanded;
  }
}

class ObjectSpriteItem extends StitchTreeItemBase<'asset-sprites'> {
  override readonly kind = 'asset-sprites';
  parent = undefined;

  constructor(readonly sprite: Asset<'sprites'>) {
    super(sprite.name);
    this.contextValue = this.kind;
    this.setGameMakerIcon('sprite');
    this.command = {
      command: 'vscode.open',
      title: 'Open',
      arguments: [uriFromPathy(this.sprite.framePaths[0])],
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

  constructor(readonly provider: StitchProvider) {}

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
        new ObjectParentFolder(),
        new ObjectSpriteFolder(),
        new ObjectEvents(),
        new ObjectChildren(),
      ];
    } else if (element instanceof ObjectParentFolder && this.asset.parent) {
      return [new ObjectItem(this.asset.parent)];
    } else if (element instanceof ObjectSpriteFolder) {
      const sprite = this.asset.sprite;
      logger.info('Found sprite?', !!sprite, sprite?.name);
      if (sprite) {
        return [new ObjectSpriteItem(sprite)];
      }
    } else if (element instanceof ObjectEvents) {
      const events = this.asset.gmlFilesArray.map((code) => {
        return new ObjectEventItem(code);
      });
      return events;
    } else if (element instanceof ObjectChildren) {
      return this.asset.children.sort(createSorter('name')).map((child) => {
        return new ObjectItem(child);
      });
    }
    return;
  }

  rebuild() {
    const currentAsset = this.provider.getCurrentAsset();
    if (
      !currentAsset ||
      !isAssetOfKind(currentAsset, 'objects') ||
      this.asset === currentAsset
    ) {
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
    const subscriptions = [this.view, activeEditorMonitor];
    return subscriptions;
  }
}
