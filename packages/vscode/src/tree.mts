import { Asset, Code } from '@bscotch/gml-parser';
import vscode from 'vscode';
import type { GameMakerProject } from './extension.project.mjs';
import type { StitchProvider } from './extension.provider.mjs';
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
  searchInput = vscode.window.createInputBox();

  private _onDidChangeTreeData: vscode.EventEmitter<
    Treeable | undefined | null | void
  > = new vscode.EventEmitter<Treeable | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<
    Treeable | undefined | null | void
  > = this._onDidChangeTreeData.event;

  constructor(readonly provider: StitchProvider) {}

  get projects(): GameMakerProject[] {
    return this.provider.projects;
  }

  /**
   * Reveal an associate tree item in the sidebar.
   * For folders, the value just be the folder's path string
   * with `/` separators.
   */
  reveal(item: string | Asset | Code | undefined) {
    console.log('reveal', item);
    item ||= this.provider.getCurrentAsset();
    if (!item) {
      return;
    }
    const treeItem =
      typeof item === 'string'
        ? GameMakerFolder.lookup.get(item)
        : item instanceof Asset
        ? TreeAsset.lookup.get(item)
        : TreeCode.lookup.get(item);
    if (!treeItem) {
      return;
    }
    this.view.reveal(treeItem);
  }

  async createScript(where: GameMakerFolder) {
    const newScriptName = await vscode.window.showInputBox({
      prompt: 'Enter a name for the new Script',
      placeHolder: 'e.g. my/new/MyScript',
      validateInput(value) {
        if (!value) {
          return;
        }
        if (!value.match(/^[a-zA-Z0-9_][a-zA-Z0-9_/]*/)) {
          return 'Script names must start with a letter or underscore, and can only contain letters, numbers, and underscores.';
        }
        return;
      },
    });
    if (!newScriptName) {
      return;
    }
    const existingAsset = where.project.getAssetByName(newScriptName);
    if (existingAsset) {
      vscode.window.showErrorMessage(
        `An asset named ${newScriptName} already exists.`,
      );
      return;
    }
    const parts = newScriptName.split('/');
    const name = parts.pop()!;
    let folder = where;
    for (const part of parts) {
      folder = folder.addFolder(part);
    }
    const path = folder.path + '/' + name;
    const asset = await where.project.addScript(path);
    if (!asset) {
      vscode.window.showErrorMessage(`Failed to create new script.`);
      return;
    }
    const treeItem = folder.addResource(new TreeAsset(folder, asset));
    this._onDidChangeTreeData.fire(where);
    this.view.reveal(treeItem);
  }

  /**
   * Create a new folder in the GameMaker asset tree. */
  async createFolder(where: GameMakerFolder | undefined) {
    where ||= this.tree;
    const newFolderName = await vscode.window.showInputBox({
      prompt: 'Enter a name for the new folder',
      placeHolder: 'e.g. my/new/folder',
      validateInput(value) {
        if (!value) {
          return;
        }
        if (!value.match(/^[a-zA-Z0-9_][a-zA-Z0-9_/ ]*/)) {
          return 'Folder names must start with a letter or underscore, and can only contain letters, numbers, underscores, and spaces.';
        }
        return;
      },
    });
    if (!newFolderName) {
      return;
    }
    const parts = newFolderName.split('/');
    let folder = where;
    for (const part of parts) {
      folder = folder.addFolder(part);
    }
    // Ensure that this folder exists in the actual project.
    await where.project.addFolder(folder.path);
    this._onDidChangeTreeData.fire(where);
    this.view.reveal(folder);
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
      const projectFolder = this.tree.addFolder(project.name, project);
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
    const subscriptions = [
      this.view,
      vscode.commands.registerCommand(
        'stitch.assets.newFolder',
        this.createFolder.bind(this),
      ),
      vscode.commands.registerCommand(
        'stitch.assets.newScript',
        this.createScript.bind(this),
      ),
      vscode.commands.registerCommand(
        'stitch.assets.reveal',
        this.reveal.bind(this),
      ),
    ];
    return subscriptions;
  }
}
