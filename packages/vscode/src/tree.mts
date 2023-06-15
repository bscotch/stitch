import vscode from 'vscode';
import type { GameMakerProject } from './extension.project.mjs';
import { warn } from './log.mjs';
import {
  GameMakerFolder,
  TreeAsset,
  TreeCode,
  TreeShaderFile,
  TreeSpriteFrame,
  Treeable,
} from './tree.base.mjs';

export class GameMakerTreeProvider
  implements vscode.TreeDataProvider<Treeable>
{
  tree: GameMakerFolder = new GameMakerFolder(undefined, 'root');
  view!: vscode.TreeView<Treeable>;

  private _onDidChangeTreeData: vscode.EventEmitter<
    Treeable | undefined | null | void
  > = new vscode.EventEmitter<Treeable | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<
    Treeable | undefined | null | void
  > = this._onDidChangeTreeData.event;

  constructor(readonly projects: GameMakerProject[]) {}

  /**
   * Create a new folder in the GameMaker asset tree. */
  async createFolder(where: GameMakerFolder | undefined) {
    where ||= this.tree;
    where.collapsibleState = vscode.TreeItemCollapsibleState.Expanded;
    console.log(where.heirarchy);
    const newFolderName = await vscode.window.showInputBox({
      prompt: 'Enter a name for the new folder',
      placeHolder: 'e.g. my/new/folder',
      validateInput(value) {
        if (!value) {
          return;
        }
        if (value.match(/[\s\r\n]/)) {
          return 'Folder names cannot contain whitespace.';
        }
        if (!value.match(/^[a-zA-Z0-9_][a-zA-Z0-9_/]*/)) {
          return 'Folder names must be valid GameMaker identifiers.';
        }
        return;
      },
    });
    if (!newFolderName) {
      return;
    }
    const parts = newFolderName.split('/');
    let parent = where;
    for (const part of parts) {
      parent = parent.addFolder(part);
      parent.collapsibleState = vscode.TreeItemCollapsibleState.Expanded;
      // TODO: Ensure that this folder exists in the actual project.
    }
    this._onDidChangeTreeData.fire(where);
    this.view.reveal(parent);
  }

  getTreeItem(element: Treeable): vscode.TreeItem {
    return element;
  }

  getParent(element: Treeable): vscode.ProviderResult<Treeable> {
    return element.parent;
  }

  getChildren(element?: Treeable | undefined) {
    if (!element) {
      // Then we're at the root.
      // If there is only one project (folder), we can return its tree.
      // If there is more than one project,  we return the projects.
      let root = this.tree;
      if (this.projects.length === 1) {
        root = this.tree.folders[0];
      }
      return [...root.folders, ...root.resources];
    }
    if (element instanceof GameMakerFolder) {
      return [...element.folders, ...element.resources];
    } else if (element instanceof TreeAsset) {
      if (element.asset.assetType === 'objects') {
        return element.asset.gmlFilesArray.map((f) => new TreeCode(element, f));
      } else if (element.asset.assetType === 'sprites') {
        return element.asset.framePaths.map(
          (p, i) => new TreeSpriteFrame(element, p, i),
        );
      } else if (element.asset.assetType === 'shaders') {
        const paths = element.asset.shaderPaths!;
        return [
          new TreeShaderFile(element, paths.fragment),
          new TreeShaderFile(element, paths.vertex),
        ];
      }
    }
    return;
  }

  refresh() {
    const folderPathToParts = (folderPath: string) =>
      folderPath
        .replace(/^folders[\\/]/, '')
        .replace(/\.yy$/, '')
        .split(/[\\/]/);

    this.tree = new GameMakerFolder(undefined, 'root');
    for (const project of this.projects) {
      const projectFolder = this.tree.addFolder(project.name, true);
      // Add all of the folders
      for (const folder of project.yyp.Folders) {
        const pathParts = folderPathToParts(folder.folderPath);
        let parent = projectFolder;
        for (let i = 0; i < pathParts.length; i++) {
          parent = parent.addFolder(pathParts[i]);
        }
      }
      // Add all of the resources
      for (const [, resource] of project.assets) {
        const path = (resource.yy.parent as any).path;
        if (!path) {
          warn('Resource has no path', resource);
          continue;
        }
        const pathParts = folderPathToParts(path);
        let parent = projectFolder;
        for (let i = 0; i < pathParts.length; i++) {
          parent = parent.addFolder(pathParts[i]);
        }
        parent.addResource(new TreeAsset(parent, resource));
      }
    }
    this._onDidChangeTreeData.fire();
    return this;
  }

  register() {
    this.view = vscode.window.createTreeView('bscotch-stitch-resources', {
      treeDataProvider: this.refresh(),
    });
    return this.view;
  }
}
