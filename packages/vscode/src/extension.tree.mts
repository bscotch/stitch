import path from 'path';
import vscode from 'vscode';
import type { GmlFile } from './extension.gml.mjs';
import type { GameMakerProject } from './extension.project.mjs';
import {
  GameMakerShaderFile,
  GameMakerSpriteFrame,
  type GameMakerResource,
} from './extension.resource.mjs';

// ICONS: See https://code.visualstudio.com/api/references/icons-in-labels#icon-listing

export class StitchTreeItemBase extends vscode.TreeItem {
  setBaseIcon(icon: string) {
    this.iconPath = new vscode.ThemeIcon(icon);
  }

  setFileIcon(icon: string) {
    this.iconPath = path.join(
      __dirname,
      '..',
      'images',
      'files',
      icon + '.svg',
    );
  }

  setGameMakerIcon(icon: string) {
    this.iconPath = path.join(__dirname, '..', 'images', 'gm', icon + '.svg');
  }
  setObjectEventIcon(icon: string) {
    this.iconPath = path.join(
      __dirname,
      '..',
      'images',
      'gm',
      'obj',
      icon + '.svg',
    );
  }
}

export class GameMakerFolder extends StitchTreeItemBase {
  readonly kind = 'folder';
  folders: GameMakerFolder[] = [];
  resources: GameMakerResource[] = [];

  constructor(readonly name: string, readonly isProject = false) {
    super(name);
    this.collapsibleState = vscode.TreeItemCollapsibleState.Collapsed;

    this.contextValue = 'folder';
    if (isProject) {
      this.setGameMakerIcon('gamemaker');
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
    vscode.TreeDataProvider<
      | GameMakerResource
      | GameMakerFolder
      | GameMakerSpriteFrame
      | GmlFile
      | GameMakerShaderFile
    >
{
  tree: GameMakerFolder = new GameMakerFolder('root');

  constructor(readonly projects: GameMakerProject[]) {}

  getTreeItem(element: GameMakerResource | GameMakerFolder | GmlFile) {
    return element;
  }

  getChildren(
    element?:
      | GameMakerResource
      | GameMakerFolder
      | GmlFile
      | GameMakerSpriteFrame
      | GameMakerShaderFile
      | undefined,
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
      } else if (element.type === 'sprites') {
        return element
          .framePaths()
          .map((p, i) => new GameMakerSpriteFrame(p, i));
      } else if (element.type == 'shaders') {
        return element.shaders.map((s) => new GameMakerShaderFile(s));
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
      for (const [, resource] of project.resources) {
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
        // parent.addResource(resource);
      }
    }
    return this;
  }

  register() {
    return vscode.window.registerTreeDataProvider(
      'bscotch-stitch-resources',
      this.refresh(),
    );
  }
}
