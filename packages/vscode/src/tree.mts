import { Asset, Code } from '@bscotch/gml-parser';
import vscode from 'vscode';
import { GameMakerProject } from './extension.project.mjs';
import type { StitchProvider } from './extension.provider.mjs';
import { warn } from './log.mjs';

import {
  GameMakerFolder,
  GameMakerProjectFolder,
  GameMakerRootFolder,
} from './tree.folder.mjs';
import {
  TreeAsset,
  TreeCode,
  TreeFilter,
  TreeFilterGroup,
  TreeShaderFile,
  TreeSpriteFrame,
} from './tree.items.mjs';

export type Treeable =
  | TreeAsset
  | TreeCode
  | TreeSpriteFrame
  | TreeShaderFile
  | TreeFilterGroup
  | TreeFilter
  | GameMakerFolder;

export class GameMakerTreeProvider
  implements vscode.TreeDataProvider<Treeable>
{
  tree = new GameMakerRootFolder();
  view!: vscode.TreeView<Treeable>;

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
    const existingAsset = where.project!.getAssetByName(newScriptName);
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
    const asset = await where.project!.addScript(path);
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
    await where.project!.addFolder(folder.path);
    this._onDidChangeTreeData.fire(where);
    this.view.reveal(folder);
  }

  getTreeItem(element: Treeable): vscode.TreeItem {
    return element;
  }

  getParent(element: Treeable): vscode.ProviderResult<Treeable> {
    return element.parent;
  }

  getChildren(element?: Treeable | undefined): Treeable[] | undefined {
    const assetSorter = (a: TreeAsset, b: TreeAsset) => {
      return a.asset.name
        .toLowerCase()
        .localeCompare(b.asset.name.toLowerCase());
    };
    const folderSorter = (a: GameMakerFolder, b: GameMakerFolder) => {
      return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
    };

    if (!element) {
      // Then we're at the root.
      // If there is only one project (folder), we can return its tree.
      if (this.projects.length === 1) {
        return this.getChildren(this.tree.folders[0]);
      } else {
        return this.tree.folders;
      }
    } else if (element instanceof GameMakerProjectFolder) {
      return [
        element.filterGroup,
        ...element.folders.sort(folderSorter),
        ...element.resources.sort(assetSorter),
      ];
    } else if (element instanceof GameMakerFolder) {
      return [
        ...element.folders.sort(folderSorter),
        ...element.resources.sort(assetSorter),
      ];
    } else if (element instanceof TreeFilterGroup) {
      return element.filters.sort((a, b) => a.query.localeCompare(b.query));
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

  rebuild() {
    const folderPathToParts = (folderPath: string) =>
      folderPath
        .replace(/^folders[\\/]/, '')
        .replace(/\.yy$/, '')
        .split(/[\\/]/);

    // Grab the current filters before nuking everything.
    const filterGroups = new Map<GameMakerProject, TreeFilterGroup>();
    for (const projectFolder of this.tree.folders) {
      filterGroups.set(projectFolder.project, projectFolder.filterGroup);
    }

    // Rebuild the tree
    this.tree = new GameMakerRootFolder();
    for (const project of this.projects) {
      const projectFolder = this.tree.addFolder(
        project.name,
        project,
      ) as GameMakerProjectFolder;
      // Add the filter groups
      if (filterGroups.has(project)) {
        projectFolder.filterGroup = filterGroups.get(project)!;
      } else {
        for (const filterGroupName of ['Folders', 'Assets']) {
          const filterGroup = new TreeFilterGroup(
            projectFolder,
            filterGroupName,
          );
          projectFolder.filterGroup = filterGroup;
        }
      }

      const query = projectFolder.filterGroup.enabled?.query;
      const filter = query?.length ? new RegExp(query, 'i') : undefined;

      // Add all of the folders, unless we're filtering
      if (!filter) {
        for (const folder of project.yyp.Folders) {
          const pathParts = folderPathToParts(folder.folderPath);
          let parent = projectFolder as GameMakerFolder;
          for (let i = 0; i < pathParts.length; i++) {
            parent = parent.addFolder(pathParts[i]);
          }
        }
      }

      // Add all of the resources, applying the filter if any
      for (const [, resource] of project.assets) {
        const path = (resource.yy.parent as any).path;
        if (!path) {
          warn('Resource has no path', resource);
          continue;
        }
        const pathParts = folderPathToParts(path);
        // Apply asset filters, if any
        if (filter && !resource.name.match(filter)) {
          continue;
        }
        let parent = projectFolder as GameMakerFolder;
        for (let i = 0; i < pathParts.length; i++) {
          parent = parent.addFolder(pathParts[i]);
        }
        parent.addResource(new TreeAsset(parent, resource));
      }
    }
    this._onDidChangeTreeData.fire();
    return this;
  }

  async createFilter(group: TreeFilterGroup) {
    const query = await vscode.window.showInputBox({
      prompt: 'Provide a query term to filter the tree',
    });
    if (!query) {
      return;
    }
    const filter = group.addFilter(query);
    this.rebuild();
    this.view.reveal(filter);
  }

  deleteFilter(filter: TreeFilter) {
    const requiresRefresh = filter.enabled;
    filter.delete();
    if (requiresRefresh) {
      this.rebuild();
    } else {
      this._onDidChangeTreeData.fire(filter.parent);
    }
  }

  enableFilter(filter: TreeFilter) {
    filter.parent.enable(filter);
    this.rebuild();
  }

  disableFilter(filter: TreeFilter) {
    filter.parent.disable(filter);
    this.rebuild();
  }

  register() {
    this.view = vscode.window.createTreeView('bscotch-stitch-resources', {
      treeDataProvider: this.rebuild(),
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
      vscode.commands.registerCommand(
        'stitch.assets.filters.delete',
        this.deleteFilter.bind(this),
      ),
      vscode.commands.registerCommand(
        'stitch.assets.filters.enable',
        this.enableFilter.bind(this),
      ),
      vscode.commands.registerCommand(
        'stitch.assets.filters.disable',
        this.disableFilter.bind(this),
      ),
      vscode.commands.registerCommand(
        'stitch.assets.filters.new',
        this.createFilter.bind(this),
      ),
    ];
    return subscriptions;
  }
}
