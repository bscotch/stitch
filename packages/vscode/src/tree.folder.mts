import vscode from 'vscode';
import type { GameMakerProject } from './extension.project.mjs';
import { StitchTreeItemBase } from './tree.base.mjs';
import { TreeAsset } from './tree.items.mjs';

export class GameMakerFolder extends StitchTreeItemBase<'folder'> {
  override readonly kind = 'folder';
  folders: GameMakerFolder[] = [];
  resources: TreeAsset[] = [];

  /** folderPath:GameMakerFolder lookup, for revealing items and filtering.*/
  static lookup: Map<string, GameMakerFolder> = new Map();

  constructor(
    readonly parent: GameMakerFolder | undefined,
    readonly name: string,
    /** If this is the root node, the associated project. */
    readonly _project: GameMakerProject | undefined = undefined,
  ) {
    super(name);
    GameMakerFolder.lookup.set(this.path, this);

    this.collapsibleState = vscode.TreeItemCollapsibleState.Collapsed;

    // Override the 'folder' value for projects
    if (_project) {
      this.setGameMakerIcon('gamemaker');
      this.contextValue = 'project';
    }
    this.id = this.path;
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
    return resource;
  }
}
