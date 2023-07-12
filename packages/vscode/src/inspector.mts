import {
  Asset,
  Code,
  getEventFromFilename,
  isAssetOfKind,
} from '@bscotch/gml-parser';
import { Pathy } from '@bscotch/pathy';
import vscode from 'vscode';
import type { StitchProvider } from './extension.provider.mjs';
import { uriFromPathy } from './lib.mjs';
import { logger } from './log.mjs';
import { StitchTreeItemBase, setEventIcon } from './tree.base.mjs';

type InspectorItem =
  | ObjectParentContainer
  | ObjectEvents
  | ObjectEventItem
  | ObjectSpriteItem
  | ObjectSpriteContainer;

class ObjectParentContainer extends StitchTreeItemBase<'inspector-object-parents'> {
  override readonly kind = 'inspector-object-parents';
  parent = undefined;
  constructor() {
    super('Parent');
    this.contextValue = this.kind;
    this.collapsibleState = vscode.TreeItemCollapsibleState.Expanded;
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

class ObjectEventItem extends StitchTreeItemBase<'asset-objects'> {
  override readonly kind = 'asset-objects';
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

class ObjectSpriteContainer extends StitchTreeItemBase<'inspector-sprites'> {
  override readonly kind = 'inspector-sprites';
  parent = undefined;
  constructor() {
    super('Sprite');
    this.contextValue = this.kind;
    this.collapsibleState = vscode.TreeItemCollapsibleState.Expanded;
  }
}

class ObjectSpriteItem extends StitchTreeItemBase<'inspector-sprite'> {
  override readonly kind = 'inspector-sprite';
  parent = undefined;

  constructor(readonly imagePath: Pathy<Buffer>, readonly idx: number) {
    super(`[${idx}] ${imagePath.name}`);
    this.contextValue = this.kind;
    this.iconPath = vscode.Uri.file(imagePath.absolute);
    this.command = {
      command: 'vscode.open',
      title: 'Open',
      arguments: [this.iconPath],
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
        new ObjectParentContainer(),
        new ObjectSpriteContainer(),
        new ObjectEvents(),
      ];
    } else if (element instanceof ObjectParentContainer) {
      return undefined;
    } else if (element instanceof ObjectSpriteContainer) {
      return this.asset.framePaths.map((p, i) => new ObjectSpriteItem(p, i));
    } else if (element instanceof ObjectEvents) {
      const events = this.asset.gmlFilesArray.map((code) => {
        return new ObjectEventItem(code);
      });
      return events;
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
