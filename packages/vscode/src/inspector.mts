import {
  Asset,
  Code,
  getEventFromFilename,
  isAssetOfKind,
} from '@bscotch/gml-parser';
import vscode from 'vscode';
import type { StitchProvider } from './extension.provider.mjs';
import { logger } from './log.mjs';
import { StitchTreeItemBase } from './tree.base.mjs';

type InspectorItem = ObjectItem;

class ObjectItem extends StitchTreeItemBase<'inspector-object'> {
  override readonly kind = 'inspector-object';
  parent = undefined;
  constructor(readonly asset: Asset<'objects'>) {
    super(asset.name);
    this.contextValue = `inspector-object`;
  }
}

class ObjectEventItem extends StitchTreeItemBase<'inspector-object-event'> {
  override readonly kind = 'inspector-object-event';
  override parent: ObjectItem;

  constructor(parent: ObjectItem, code: Code) {
    super(code.name);
    this.parent = parent;
    this.contextValue = this.kind;

    this.collapsibleState = vscode.TreeItemCollapsibleState.None;
    this.command = {
      command: 'vscode.open',
      title: 'Open',
      arguments: [code.path.toAbsolute],
    };
    this.setIcon();
    this.id = this.parent.id + '/' + this.code.name;

    // Ensure that the tree label is human-friendly.
    this.label = getEventFromFilename(this.uri.fsPath);
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

  getParent(element: InspectorItem): vscode.ProviderResult<InspectorItem> {
    return undefined;
  }

  getChildren(
    element?: InspectorItem | undefined,
  ): InspectorItem[] | undefined {
    if (!element) {
      // Then we're at the root.
    }
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
