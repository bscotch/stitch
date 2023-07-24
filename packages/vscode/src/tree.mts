import {
  Asset,
  Code,
  ObjectEvent,
  isAssetOfKind,
  objectEvents,
} from '@bscotch/gml-parser';
import vscode from 'vscode';
import { assertLoudly } from './assert.mjs';
import { GameMakerProject } from './extension.project.mjs';
import type { StitchProvider } from './extension.provider.mjs';
import { registerCommand, uriFromCodeFile } from './lib.mjs';
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
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private _onDidCollapseElement: vscode.EventEmitter<
    Treeable | undefined | null | void
  > = new vscode.EventEmitter<Treeable | undefined | null | void>();
  readonly onDidCollapseElement = this._onDidCollapseElement.event;

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

  /**
   * Prompt the user for a new asset name and do all of
   * the non-type-specific prep work for creating the asset.
   */
  protected async prepareForNewAsset(where: GameMakerFolder) {
    const newAssetName = await vscode.window.showInputBox({
      prompt: `Provide a name for the new asset`,
      placeHolder: 'e.g. my/new/Asset',
      validateInput(value) {
        if (!value) {
          return;
        }
        if (!value.match(/^[a-zA-Z0-9_][a-zA-Z0-9_/]*/)) {
          return 'Asset names must start with a letter or underscore, and can only contain letters, numbers, and underscores.';
        }
        return;
      },
    });
    if (!newAssetName) {
      return;
    }
    const existingAsset = where.project!.getAssetByName(newAssetName);
    if (existingAsset) {
      vscode.window.showErrorMessage(
        `An asset named ${newAssetName} already exists.`,
      );
      return;
    }
    const parts = newAssetName.split('/');
    const name = parts.pop()!;
    let folder = where;
    for (const part of parts) {
      folder = folder.addFolder(part);
    }
    const path = folder.path + '/' + name;
    return { folder, path, name };
  }

  protected afterNewAssetCreated(
    asset: Asset | undefined,
    folder: GameMakerFolder,
    addedTo: GameMakerFolder,
  ) {
    if (!asset) {
      vscode.window.showErrorMessage(`Failed to create new asset.`);
      return;
    }
    const treeItem = folder.addResource(new TreeAsset(folder, asset));
    this._onDidChangeTreeData.fire(addedTo);
    this.view.reveal(treeItem);
  }

  async setParent(objectItem: TreeAsset) {
    console.log(objectItem);
  }

  async createEvent(objectItem: TreeAsset) {
    const asset = objectItem.asset;
    assertLoudly(
      isAssetOfKind(asset, 'objects'),
      `Cannot create event for ${asset.assetKind} asset.`,
    );
    const events: (
      | ObjectEvent
      | { kind: vscode.QuickPickItemKind.Separator; label: string }
    )[] = [];
    for (let i = 0; i < objectEvents.length; i++) {
      const event = objectEvents[i];
      if (i > 0 && objectEvents[i - 1].group !== event.group) {
        // Add a separator between event types
        events.push({
          kind: vscode.QuickPickItemKind.Separator,
          label: event.group,
        });
      }
      events.push(event);
    }
    const eventInfo = await vscode.window.showQuickPick(events, {
      title: 'Select which type of event to create.',
    });
    if (!eventInfo || !('eventNum' in eventInfo)) {
      return;
    }
    const code = await asset.createEvent(eventInfo);
    if (!code) {
      return;
    }
    if (
      'onCreateEvent' in objectItem &&
      typeof objectItem.onCreateEvent === 'function'
    ) {
      objectItem.onCreateEvent(eventInfo);
    }
    this._onDidChangeTreeData.fire(objectItem);
    this.view.reveal(objectItem);
    vscode.window.showTextDocument(uriFromCodeFile(code));
  }

  async createObject(where: GameMakerFolder) {
    const info = await this.prepareForNewAsset(where);
    if (!info) {
      return;
    }
    const { folder, path } = info;
    const asset = await where.project!.addObject(path);
    this.afterNewAssetCreated(asset, folder, where);
  }

  async createScript(where: GameMakerFolder) {
    const info = await this.prepareForNewAsset(where);
    if (!info) {
      return;
    }
    const { folder, path } = info;
    const asset = await where.project!.addScript(path);
    this.afterNewAssetCreated(asset, folder, where);
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
      if (element.asset.assetKind === 'objects') {
        return element.asset.gmlFilesArray.map((f) => new TreeCode(element, f));
      } else if (element.asset.assetKind === 'sprites') {
        return element.asset.framePaths.map(
          (p, i) => new TreeSpriteFrame(element, p, i),
        );
      } else if (element.asset.assetKind === 'shaders') {
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
    const toReveal: Treeable[] = [];

    // Grab the current filters before nuking everything.
    const filterGroups = new Map<GameMakerProject, TreeFilterGroup>();
    for (const projectFolder of this.tree.folders) {
      filterGroups.set(projectFolder.project, projectFolder.filterGroup);
    }

    // Rebuild the tree
    this.tree = new GameMakerRootFolder();
    for (const project of this.projects) {
      const projectFolder = this.tree.addFolder(project.name, {
        project,
      }) as GameMakerProjectFolder;
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
      // If filtering, everything should be in the OPEN state
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
        const asset = new TreeAsset(parent, resource);
        parent.addResource(asset);
        if (filter) {
          toReveal.push(asset);
        }
      }
    }
    this._onDidChangeTreeData.fire();
    for (const element of toReveal) {
      this.view.reveal(element, { focus: false, expand: false, select: false });
    }
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

  async editFilter(filter: TreeFilter) {
    const query = await vscode.window.showInputBox({
      prompt: 'Update the asset filter query',
      value: filter.query,
    });
    if (!query) {
      return;
    }
    filter.query = query;
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
      showCollapseAll: true,
    });
    const subscriptions = [
      this.view,
      registerCommand('stitch.assets.newFolder', this.createFolder.bind(this)),
      registerCommand('stitch.assets.newScript', this.createScript.bind(this)),
      registerCommand('stitch.assets.newObject', this.createObject.bind(this)),
      registerCommand('stitch.assets.newEvent', this.createEvent.bind(this)),
      registerCommand('stitch.assets.setParent', this.setParent.bind(this)),
      registerCommand('stitch.assets.reveal', this.reveal.bind(this)),
      registerCommand(
        'stitch.assets.filters.delete',
        this.deleteFilter.bind(this),
      ),
      registerCommand(
        'stitch.assets.filters.enable',
        this.enableFilter.bind(this),
      ),
      registerCommand(
        'stitch.assets.filters.disable',
        this.disableFilter.bind(this),
      ),
      registerCommand(
        'stitch.assets.filters.new',
        this.createFilter.bind(this),
      ),
      registerCommand('stitch.assets.filters.edit', this.editFilter.bind(this)),
    ];
    return subscriptions;
  }
}
