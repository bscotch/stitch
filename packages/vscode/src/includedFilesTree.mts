import vscode from 'vscode';
import { stitchEvents } from './events.mjs';
import type { GameMakerProject } from './extension.project.mjs';
import type { StitchWorkspace } from './extension.workspace.mjs';
import { registerCommand } from './lib.mjs';
import { StitchTreeItemBase } from './tree.base.mjs';

type IncludedFileTreeItem = IncludedFileFolder | IncludedFile;

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
    if (element && !(element instanceof IncludedFileFolder)) {
      return [];
    }
    // If we have no element we need the root.
    element ||= IncludedFileFolder.lookup.get('datafiles');

    // Then we're at the root.
    const children =
      element?.subfolders || ([] as (IncludedFile | IncludedFileFolder)[]);
    children.push(...(element?.files || []));
    return [...children].sort((a, b) => {
      if (a instanceof IncludedFileFolder && b instanceof IncludedFile) {
        return -1;
      }
      if (a instanceof IncludedFile && b instanceof IncludedFileFolder) {
        return 1;
      }
      const aStr = (a.label?.toString() || '').toLocaleLowerCase();
      const bStr = (b.label?.toString() || '').toLocaleLowerCase();
      return aStr.localeCompare(bStr);
    });
  }

  rebuild() {
    // Convert the project's included files into a tree,
    // consisting of folders and files.
    IncludedFileFolder.clear();
    IncludedFile.clear();
    if (!this.project) {
      return;
    }
    for (const file of this.project.yyp.IncludedFiles || []) {
      IncludedFile.from(
        this.project,
        file.filePath as IncludedFilePath,
        file.name,
      );
    }

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

    stitchEvents.on('datafiles-changed', (project) => {
      if (tree.project === project) {
        tree.rebuild();
      }
    });

    // Return subscriptions to owned events and this view
    const subscriptions = [
      tree.view,
      activeEditorMonitor,
      registerCommand(
        'stitch.includedFiles.revealInExplorerView',
        (item?: IncludedFile) => {
          if (item instanceof IncludedFile) {
            // Call the vscode command to show the file in the explorer view
            vscode.commands.executeCommand(
              'revealInExplorer',
              vscode.Uri.file(item.path.absolute),
            );
          }
        },
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
  files: IncludedFile[] = [];

  static lookup = new Map<string, IncludedFileFolder>();
  protected constructor(readonly path: IncludedFilePath) {
    super(path.split('/').at(-1)!);
    this.contextValue = this.kind;
    this.collapsibleState = vscode.TreeItemCollapsibleState.Collapsed;
  }

  static from(folderPath: IncludedFilePath): IncludedFileFolder {
    if (this.lookup.has(folderPath)) {
      return this.lookup.get(folderPath)!;
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
    return parentFolder!;
  }
  static clear() {
    this.lookup.clear();
  }
}

class IncludedFile extends StitchTreeItemBase<'datafiles-file'> {
  override readonly kind = 'datafiles-file';
  parent: IncludedFileFolder;
  static lookup = new Map<string, IncludedFile>();

  protected constructor(
    readonly project: GameMakerProject,
    readonly folder: IncludedFilePath,
    readonly name: string,
  ) {
    super(name);
    this.contextValue = this.kind;
    this.collapsibleState = vscode.TreeItemCollapsibleState.None;
    this.parent = IncludedFileFolder.from(folder);
    this.parent.files.push(this);
    this.command = {
      title: 'Open',
      command: 'vscode.open',
      arguments: [
        vscode.Uri.file(this.project.dir.join(folder).join(name).absolute),
      ],
    };
    this.iconPath = new vscode.ThemeIcon('file');
  }

  get path() {
    return this.project.dir.join(this.folder).join(this.name);
  }

  static from(
    project: GameMakerProject,
    folderPath: IncludedFilePath,
    name: string,
  ): IncludedFile {
    const fullPath = `${folderPath}/${name}`;
    if (this.lookup.has(fullPath)) {
      return this.lookup.get(fullPath)!;
    }
    const file = new IncludedFile(project, folderPath, name);
    this.lookup.set(fullPath, file);
    return file;
  }

  static clear() {
    this.lookup.clear();
  }
}
