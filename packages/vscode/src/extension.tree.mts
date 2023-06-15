import { Asset, Code } from '@bscotch/gml-parser';
import { Pathy } from '@bscotch/pathy';
import path from 'path';
import vscode from 'vscode';
import type { GameMakerProject } from './extension.project.mjs';
import { warn } from './log.mjs';
import { getEventName } from './spec.events.mjs';

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
  resources: TreeAsset[] = [];

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

  getResource(name: string): TreeAsset | undefined {
    return this.resources.find((x) => x.asset.name === name);
  }

  addResource(resource: TreeAsset) {
    if (!this.getResource(resource.asset.name)) {
      this.resources.push(resource);
    }
  }
}

export type Treeable =
  | TreeAsset
  | TreeCode
  | TreeSpriteFrame
  | TreeShaderFile
  | GameMakerFolder;

export class GameMakerTreeProvider
  implements vscode.TreeDataProvider<Treeable>
{
  tree: GameMakerFolder = new GameMakerFolder('root');

  constructor(readonly projects: GameMakerProject[]) {}

  getTreeItem(element: Treeable): vscode.TreeItem {
    return element;
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
        return element.asset.gmlFilesArray.map((f) => new TreeCode(f));
      } else if (element.asset.assetType === 'sprites') {
        return element.asset.framePaths.map(
          (p, i) => new TreeSpriteFrame(p, i),
        );
      } else if (element.asset.assetType === 'shaders') {
        const paths = element.asset.shaderPaths!;
        return [
          new TreeShaderFile(paths.fragment),
          new TreeShaderFile(paths.vertex),
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
        parent.addResource(new TreeAsset(resource));
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

export class TreeAsset extends StitchTreeItemBase {
  readonly kind = 'asset';
  readonly asset: Asset;

  constructor(asset: Asset) {
    super(asset.name);
    this.asset = asset;
    this.refreshTreeItem();
  }

  protected refreshTreeItem() {
    let file: vscode.Uri;
    if (this.asset.assetType === 'scripts') {
      const gmlFiles = [...this.asset.gmlFiles.values()];
      file = vscode.Uri.file(gmlFiles[0].path.absolute);
    } else {
      file = vscode.Uri.file(this.asset.yyPath.absolute);
    }
    this.command = {
      command: 'vscode.open',
      title: 'Open',
      arguments: [file],
    };

    this.collapsibleState = ['objects', 'sprites', 'shaders'].includes(
      this.asset.assetType,
    )
      ? vscode.TreeItemCollapsibleState.Collapsed
      : vscode.TreeItemCollapsibleState.None;

    this.setBaseIcon('question');

    switch (this.asset.assetType) {
      case 'objects':
        this.setBaseIcon('symbol-misc');
        break;
      case 'rooms':
        this.setGameMakerIcon('room');
        break;
      case 'scripts':
        this.setGameMakerIcon('script');
        break;
      case 'sprites':
        this.setGameMakerIcon('sprite');
        break;
      case 'sounds':
        this.setGameMakerIcon('audio');
        break;
      case 'paths':
        this.setBaseIcon('debug-disconnect');
        break;
      case 'shaders':
        this.setGameMakerIcon('shader');
        break;
      case 'timelines':
        this.setBaseIcon('clock');
        break;
      case 'fonts':
        this.setGameMakerIcon('font');
        break;
      case 'tilesets':
        this.setBaseIcon('layers');
        break;
    }
  }
}

export class TreeCode extends StitchTreeItemBase {
  readonly kind = 'code';

  constructor(readonly code: Code) {
    super(code.name);

    this.collapsibleState = vscode.TreeItemCollapsibleState.None;
    this.command = {
      command: 'vscode.open',
      title: 'Open',
      arguments: [this.uri],
    };
    this.setIcon();

    // Ensure that the tree label is human-friendly.
    this.label = getEventName(this.uri.fsPath);
  }

  get uri() {
    return vscode.Uri.file(this.code.path.absolute);
  }

  protected setIcon() {
    // Set the default
    if (this.code.name.startsWith('Other_')) {
      this.setObjectEventIcon('other');
    } else {
      this.setGameMakerIcon('script');
    }

    // Override for object events
    if (this.code.name.match(/^Draw_\d+$/i)) {
      this.setObjectEventIcon('draw');
    } else if (this.code.name.match(/^Alarm_\d+$/i)) {
      this.setObjectEventIcon('alarm');
    } else if (this.code.name.match(/^Step_\d+$/i)) {
      this.setObjectEventIcon('step');
    } else if (this.code.name === 'Create_0') {
      this.setObjectEventIcon('create');
    } else if (this.code.name === 'Destroy_0') {
      this.setObjectEventIcon('destroy');
    } else if (this.code.name === 'CleanUp_0') {
      this.setObjectEventIcon('cleanup');
    } else if (this.code.name.match(/^Other_(7[250]|6[239])$/i)) {
      this.setObjectEventIcon('asynchronous');
    }
  }
}

export class TreeSpriteFrame extends StitchTreeItemBase {
  readonly kind = 'sprite-frame';
  constructor(readonly imagePath: Pathy<Buffer>, readonly idx: number) {
    super(`[${idx}] ${imagePath.name}`);
    this.iconPath = vscode.Uri.file(imagePath.absolute);
    this.command = {
      command: 'vscode.open',
      title: 'Open',
      arguments: [this.iconPath],
    };
  }
}

export class TreeShaderFile extends StitchTreeItemBase {
  readonly kind = 'shader-file';
  constructor(readonly path: Pathy<string>) {
    super(path.hasExtension('vsh') ? 'Vertex' : 'Fragment');
    this.command = {
      command: 'vscode.open',
      title: 'Open',
      arguments: [this.uri],
    };
    this.setFileIcon('shader');
  }
  get uri() {
    return vscode.Uri.file(this.path.absolute);
  }
}
