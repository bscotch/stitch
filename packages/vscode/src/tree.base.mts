import { Asset, Code } from '@bscotch/gml-parser';
import { Pathy } from '@bscotch/pathy';
import path from 'path';
import vscode from 'vscode';
import type { GameMakerProject } from './extension.project.mjs';
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

  constructor(
    readonly parent: GameMakerFolder | undefined,
    readonly name: string,
    /** If this is the root node, the associated project. */
    readonly _project: GameMakerProject | undefined = undefined,
  ) {
    super(name);
    this.collapsibleState = vscode.TreeItemCollapsibleState.Collapsed;

    this.contextValue = 'folder';
    if (_project) {
      this.setGameMakerIcon('gamemaker');
      this.contextValue = 'project';
    }
  }

  get project(): GameMakerProject {
    return (this._project || this.parent?.project)!;
  }

  /**
   * Get the set of parents, ending with this folder, as a flat array.
   */
  get heirarchy(): GameMakerFolder[] {
    if (this.parent && !this._project) {
      return [...this.parent.heirarchy, this];
    }
    return [this];
  }

  get path(): string {
    return this.heirarchy
      .filter((f) => !f._project)
      .map((x) => x.name)
      .join('/');
  }

  getFolder(name: string): GameMakerFolder | undefined {
    return this.folders.find((x) => x.name === name) as GameMakerFolder;
  }

  addFolder(name: string, project?: GameMakerProject): GameMakerFolder {
    let folder = this.getFolder(name);
    if (!folder) {
      folder = new GameMakerFolder(this, name, project);
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

export class TreeAsset extends StitchTreeItemBase {
  readonly kind = 'asset';
  readonly asset: Asset;

  constructor(readonly parent: GameMakerFolder, asset: Asset) {
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

  constructor(readonly parent: TreeAsset, readonly code: Code) {
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
  constructor(
    readonly parent: TreeAsset,
    readonly imagePath: Pathy<Buffer>,
    readonly idx: number,
  ) {
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
  constructor(readonly parent: TreeAsset, readonly path: Pathy<string>) {
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
