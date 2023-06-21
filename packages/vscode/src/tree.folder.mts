import vscode from 'vscode';
import type { GameMakerProject } from './extension.project.mjs';
import { StitchTreeItemBase } from './tree.base.mjs';
import { TreeAsset, TreeFilterGroup } from './tree.items.mjs';

export class GameMakerFolder extends StitchTreeItemBase<'folder'> {
  override readonly kind = 'folder';
  folders: GameMakerFolder[] = [];
  resources: TreeAsset[] = [];

  /** folderPath:GameMakerFolder lookup, for revealing items and filtering.*/
  static lookup: Map<string, GameMakerFolder> = new Map();

  constructor(
    readonly parent: GameMakerFolder | undefined,
    readonly name: string,
  ) {
    super(name);
    GameMakerFolder.lookup.set(this.path, this);

    this.collapsibleState = vscode.TreeItemCollapsibleState.Collapsed;

    // Override the 'folder' value for projects
    this.contextValue = this.kind;
    this.id = this.path;
  }

  get isRoot(): boolean {
    return !this.parent;
  }

  get isProjectFolder(): boolean {
    return this.contextValue === 'project';
  }

  get isFolder(): boolean {
    return this.contextValue === 'folder';
  }

  get project(): GameMakerProject | undefined {
    return this.isFolder ? this.parent?.project : undefined;
  }

  /**
   * Get the set of parents, ending with this folder, as a flat array.
   */
  get heirarchy(): GameMakerFolder[] {
    if (this.isFolder && !this.isRoot) {
      return [...this.parent!.heirarchy, this];
    }
    return [this];
  }

  get path(): string {
    return this.heirarchy
      .filter((f) => !f.isProjectFolder)
      .map((x) => x.name)
      .join('/');
  }

  getFolder(name: string): GameMakerFolder | undefined {
    return this.folders.find((x) => x.name === name) as GameMakerFolder;
  }

  addFolder(
    name: string,
    options?: { project?: GameMakerProject },
  ): GameMakerFolder {
    let folder = this.getFolder(name);
    if (!folder) {
      folder = options?.project
        ? new GameMakerProjectFolder(this, name, options.project)
        : new GameMakerFolder(this, name);
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
    return resource;
  }
}

export class GameMakerProjectFolder extends GameMakerFolder {
  filterGroup: TreeFilterGroup;

  constructor(
    override parent: GameMakerFolder,
    name: string,
    readonly _project: GameMakerProject,
  ) {
    super(parent, name);
    this.collapsibleState = vscode.TreeItemCollapsibleState.Expanded;
    GameMakerFolder.lookup.set(this.path, this);

    this.setGameMakerIcon('gamemaker');
    this.contextValue = 'project';
    this.filterGroup = new TreeFilterGroup(this, 'Assets');
  }

  override get project(): GameMakerProject {
    return this._project;
  }
}

export class GameMakerRootFolder extends GameMakerFolder {
  override folders: GameMakerProjectFolder[] = [];
  constructor() {
    super(undefined, 'root');
  }
}
