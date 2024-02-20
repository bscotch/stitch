import vscode from 'vscode';
import type { GameMakerProject } from './extension.project.mjs';
import type { StitchWorkspace } from './extension.workspace.mjs';

type IncludedFileTreeItem = any;

export class StitchIncludedFilesTree
  implements vscode.TreeDataProvider<IncludedFileTreeItem>
{
  project: GameMakerProject | undefined;
  view!: vscode.TreeView<IncludedFileTreeItem>;
  private _onDidChangeTreeData: vscode.EventEmitter<
    IncludedFileTreeItem | undefined | null | void
  > = new vscode.EventEmitter<IncludedFileTreeItem | undefined | null | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private _onDidCollapseElement: vscode.EventEmitter<
    IncludedFileTreeItem | undefined | null | void
  > = new vscode.EventEmitter<IncludedFileTreeItem | undefined | null | void>();
  readonly onDidCollapseElement = this._onDidCollapseElement.event;

  protected constructor(readonly workspace: StitchWorkspace) {
    this.view = vscode.window.createTreeView('bscotch-stitch-files', {
      treeDataProvider: this,
    });
  }

  onUpdate(updated: IncludedFileTreeItem) {
    this._onDidChangeTreeData.fire(updated);
  }

  getTreeItem(element: IncludedFileTreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(
    element?: IncludedFileTreeItem | undefined,
  ): IncludedFileTreeItem[] | undefined {
    if (!this.project) {
      return;
    }
    if (!element) {
      // Then we're at the root.
      return [];
    }
    return;
  }

  rebuild() {
    this._onDidChangeTreeData.fire(undefined);
  }

  static register(workspace: StitchWorkspace): vscode.Disposable[] {
    const tree = new StitchIncludedFilesTree(workspace);
    tree.project = workspace.getActiveProject();
    const activeEditorMonitor = vscode.window.onDidChangeActiveTextEditor(
      () => {
        // Rebuild if we switched projects
        const nowActiveProject = workspace.getActiveProject();
        if (nowActiveProject && nowActiveProject !== tree.project) {
          tree.project = nowActiveProject;
          tree.rebuild();
        }
      },
    );

    tree.rebuild();

    // // Handle emitted events
    // stitchEvents.on('code-file-deleted', (code) => {
    //   if (this.asset === code.asset) {
    //     this.rebuild();
    //   }
    // });

    // Return subscriptions to owned events and this view
    const subscriptions = [tree.view, activeEditorMonitor];
    return subscriptions;
  }
}
