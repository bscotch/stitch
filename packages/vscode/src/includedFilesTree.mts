import vscode from 'vscode';
import { assertLoudly } from './assert.mjs';
import type { GameMakerProject } from './extension.project.mjs';
import type { StitchWorkspace } from './extension.workspace.mjs';
import { registerCommand } from './lib.mjs';
import { StitchTreeItemBase } from './tree.base.mjs';

type IncludedFileTreeItem = IncludedFileFolder;

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

  reveal(element: IncludedFileTreeItem | undefined) {
    if (element) {
      this.view.reveal(element, { expand: true, focus: true });
    }
  }

  getParent(element: IncludedFileTreeItem) {
    if (element instanceof IncludedFileFolder) {
      return element.parent;
    }
    return undefined;
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
    // If we have no element we need the root.
    element ||= IncludedFileFolder.lookup.get('datafiles');

    // Then we're at the root.
    const children = element?.subfolders || [];
    return [...children].sort((a, b) => {
      const aStr = (a.label?.toString() || '').toLocaleLowerCase();
      const bStr = (b.label?.toString() || '').toLocaleLowerCase();
      return aStr.localeCompare(bStr);
    });
  }

  async createFolder(parent?: IncludedFileFolder) {
    assertLoudly(this.project, 'No active project');
    let relativePath: string | undefined = '';
    if (parent) {
      relativePath = parent.path.split('/').slice(1).join('/') + '/';
    }
    relativePath = await vscode.window.showInputBox({
      prompt: 'Enter the name of the new folder',
      value: relativePath,
      valueSelection: [relativePath.length, relativePath.length],
      validateInput(input) {
        if (!input.match(/^[/\\a-zA-Z0-9_-]+$/)) {
          return 'Folders must be alphanumeric, and may contain dashes and underscores. Path separators are allowed for creating nested folders.';
        }
        return;
      },
    });
    if (relativePath === undefined) {
      return;
    }
    const newFolderPath = `datafiles/${relativePath}`
      .replace(/[/\\]+/g, '/')
      .replace(/\/+$/, '');
    await this.project.dir.join(newFolderPath).ensureDir();
    this.rebuild();
    const createdFolder = IncludedFileFolder.from(
      newFolderPath as IncludedFilePath,
    );
    this.reveal(createdFolder);
  }

  async rebuild() {
    // Convert the project's included files into a tree,
    // consisting of folders and files.
    IncludedFileFolder.clear();
    if (!this.project) {
      return;
    }
    for (const file of this.project.yyp.IncludedFiles || []) {
      const folder = IncludedFileFolder.from(file.filePath as IncludedFilePath);
    }
    // Also add folders that are *on disk* but not in the project, for convenience. (Also a good way to show warnings for unregistered files)
    const dataFilesDir = this.project.dir.join('datafiles');
    await dataFilesDir.listChildrenRecursively({
      filter: async (path) => {
        if (this.project && (await path.isDirectory())) {
          const relativePath = path.relativeFrom(this.project.dir);
          IncludedFileFolder.from(relativePath as IncludedFilePath);
        }
        return true;
      },
    });

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
    const subscriptions = [
      tree.view,
      activeEditorMonitor,
      registerCommand(
        'stitch.includedFiles.newFolder',
        tree.createFolder.bind(tree),
      ),
    ];
    return subscriptions;
  }
}

type IncludedFilePath = `datafiles/${string}`;
class IncludedFileFolder extends StitchTreeItemBase<'datafiles-folder'> {
  override readonly kind = 'datafiles-folder';
  parent: IncludedFileFolder | undefined;
  subfolders: IncludedFileFolder[] = [];

  static lookup = new Map<string, IncludedFileFolder>();
  protected constructor(readonly path: IncludedFilePath) {
    super(path.split('/').at(-1)!);
    this.contextValue = this.kind;
    this.collapsibleState = vscode.TreeItemCollapsibleState.Collapsed;
  }

  static from(folderPath: IncludedFilePath) {
    if (this.lookup.has(folderPath)) {
      return this.lookup.get(folderPath);
    }

    const folderParts = folderPath.split('/');
    let parentFolder: IncludedFileFolder | undefined;
    for (let i = 0; i < folderParts.length; i++) {
      const path = folderParts.slice(0, i + 1).join('/');
      if (!this.lookup.has(path)) {
        this.lookup.set(path, new IncludedFileFolder(path as IncludedFilePath));
      }
      const current = this.lookup.get(path)!;
      if (!current.parent && parentFolder) {
        current.parent = parentFolder;
        parentFolder.subfolders.push(current);
      }
      parentFolder = current;
    }
    return parentFolder;
  }
  static clear() {
    this.lookup.clear();
  }
}
