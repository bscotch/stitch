import vscode, { TreeItem } from 'vscode';
import type { StitchWorkspace } from './extension.workspace.mjs';
import { registerCommand } from './lib.mjs';

type SpriteSourceItem = TreeItem;

export class SpriteSourcesTree
  implements vscode.TreeDataProvider<SpriteSourceItem>
{
  view!: vscode.TreeView<SpriteSourceItem>;

  private _onDidChangeTreeData: vscode.EventEmitter<
    SpriteSourceItem | undefined | null | void
  > = new vscode.EventEmitter<SpriteSourceItem | undefined | null | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private _onDidCollapseElement: vscode.EventEmitter<
    SpriteSourceItem | undefined | null | void
  > = new vscode.EventEmitter<SpriteSourceItem | undefined | null | void>();
  readonly onDidCollapseElement = this._onDidCollapseElement.event;

  constructor(readonly provider: StitchWorkspace) {}

  async createSpriteSource() {
    // Have the user choose a folder
    const folder = await vscode.window.showOpenDialog({
      canSelectFiles: false,
      canSelectFolders: true,
      canSelectMany: false,
      openLabel: 'Add Source',
      title: 'Choose a Sprite Source folder',
    });
    if (!folder) return;
    // TODO: Create a config inside that folder
    // TODO: Open up that config in the editor for editing
    // TODO: Refresh the tree
  }

  getChildren(
    element?: SpriteSourceItem,
  ): vscode.ProviderResult<SpriteSourceItem[]> {
    return [];
  }

  getTreeItem(element: SpriteSourceItem): SpriteSourceItem {
    return element;
  }

  rebuild() {
    return this;
  }

  static register(workspace: StitchWorkspace): vscode.Disposable[] {
    const tree = new SpriteSourcesTree(workspace);
    tree.view = vscode.window.createTreeView('bscotch-stitch-sprite-sources', {
      treeDataProvider: tree,
      // showCollapseAll: true,
    });
    tree.rebuild();

    // Return subscriptions to owned events and this view
    const subscriptions = [
      tree.view,
      registerCommand('stitch.spriteSource.create', () => {
        tree.createSpriteSource();
      }),
    ];
    return subscriptions;
  }
}
