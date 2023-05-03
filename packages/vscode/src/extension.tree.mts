import vscode from 'vscode';
import type { GmlFile } from './extension.gml.mjs';
import type { GameMakerProject } from './extension.project.mjs';
import type { GameMakerResource } from './extension.resource.mjs';

// ICONS: See https://code.visualstudio.com/api/references/icons-in-labels#icon-listing

export class GameMakerFolder extends vscode.TreeItem {
  readonly kind = 'folder';
  folders: GameMakerFolder[] = [];
  resources: GameMakerResource[] = [];

  constructor(readonly name: string, readonly isProject = false) {
    super(name);
    this.collapsibleState = vscode.TreeItemCollapsibleState.Collapsed;

    this.contextValue = 'folder';
    if (isProject) {
      this.iconPath = new vscode.ThemeIcon('heart');
      this.contextValue = 'project';
    }
  }

  getFolder(name: string): GameMakerFolder | undefined {
    return this.folders.find((x) => x.name === name) as GameMakerFolder;
  }

  addFolder(name: string, isRoot = false): GameMakerFolder {
    let folder = this.getFolder(name);
    if (!folder) {
      folder = new GameMakerFolder(name, isRoot);
      this.folders.push(folder);
    }
    return folder;
  }

  getResource(name: string): GameMakerResource | undefined {
    return this.resources.find((x) => x.name === name);
  }

  addResource(resource: GameMakerResource) {
    if (!this.getResource(resource.name)) {
      this.resources.push(resource);
    }
  }
}

export class GameMakerTreeProvider
  implements
    vscode.TreeDataProvider<GameMakerResource | GameMakerFolder | GmlFile>
{
  tree: GameMakerFolder = new GameMakerFolder('root');

  constructor(readonly projects: GameMakerProject[]) {}

  getTreeItem(element: GameMakerResource | GameMakerFolder | GmlFile) {
    return element;
  }

  getChildren(
    element?: GameMakerResource | GameMakerFolder | GmlFile | undefined,
  ) {
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
    } else if (element.kind === 'resource') {
      if (element.type === 'objects') {
        return [...element.gmlFiles.values()];
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

    this.tree = new GameMakerFolder('root');
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
      for (const [, resource] of project.resourceNames) {
        const path = (resource.yy.parent as any).path;
        if (!path) {
          console.error('Resource has no path', resource);
          continue;
        }
        const pathParts = folderPathToParts(path);
        let parent = projectFolder;
        for (let i = 0; i < pathParts.length; i++) {
          parent = parent.addFolder(pathParts[i]);
        }
        parent.addResource(resource);
      }
    }
  }
}