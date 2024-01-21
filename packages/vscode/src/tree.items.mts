import {
  Asset,
  Code,
  getEventFromFilename,
  isAssetOfKind,
} from '@bscotch/gml-parser';
import { Pathy } from '@bscotch/pathy';
import vscode from 'vscode';
import { getAssetIcon } from './icons.mjs';
import { StitchTreeItemBase, setEventIcon } from './tree.base.mjs';
import { GameMakerFolder } from './tree.folder.mjs';
import * as fs from "fs";

// ICONS: See https://code.visualstudio.com/api/references/icons-in-labels#icon-listing

export class TreeFilterGroup extends StitchTreeItemBase<'tree-filter-group'> {
  override readonly kind = 'tree-filter-group';
  readonly filters: TreeFilter[] = [];

  constructor(
    readonly parent: GameMakerFolder,
    readonly name: string,
  ) {
    super(`Filter ${name}`);
    this.setBaseIcon('list-filter');

    this.collapsibleState = vscode.TreeItemCollapsibleState.Expanded;
    this.contextValue = this.kind;
  }

  get enabled(): TreeFilter | undefined {
    return this.filters.find((f) => f.enabled);
  }

  addFilter(query: string) {
    const filter = new TreeFilter(this, query);
    this.filters.push(filter);
    this.enable(filter);
    return filter;
  }

  enable(filter: TreeFilter) {
    this.filters.forEach((f) => (f.contextValue = `${f.kind}-disabled`));
    filter.contextValue = `${filter.kind}-enabled`;
  }

  disable(filter: TreeFilter) {
    filter.contextValue = `${filter.kind}-disabled`;
  }
}

export class TreeFilter extends StitchTreeItemBase<'tree-filter'> {
  override readonly kind = 'tree-filter';

  constructor(
    readonly parent: TreeFilterGroup,
    public query: string,
  ) {
    super(query);
    this.collapsibleState = vscode.TreeItemCollapsibleState.None;

    this.command = {
      title: 'Edit',
      command: 'stitch.assets.filters.edit',
      arguments: [this],
      tooltip: 'Edit this filter query',
    };
  }

  get enabled() {
    return this.contextValue!.endsWith('enabled');
  }

  get disabled() {
    return this.contextValue!.endsWith('disabled');
  }

  delete() {
    this.parent.filters.splice(this.parent.filters.indexOf(this), 1);
  }

  enable() {
    this.parent.enable(this);
  }

  disable() {
    this.parent.disable(this);
  }
}

export class TreeAsset extends StitchTreeItemBase<'asset'> {
  override readonly kind = 'asset';
  readonly asset: Asset;
  /** Asset:TreeItem lookup, for revealing items and filtering.  */
  static lookup: Map<Asset, TreeAsset> = new Map();

  constructor(
    readonly parent: GameMakerFolder,
    asset: Asset,
  ) {
    super(asset.name);
    this.contextValue = `asset-${asset.assetKind}`;
    TreeAsset.lookup.set(asset, this);

    this.asset = asset;
    this.refreshTreeItem();
    this.id = this.path;
  }

  get path(): string {
    return this.parent.path + '/' + this.asset.name;
  }

  refreshTreeItem() {
    let file: vscode.Uri;
    const asset = this.asset;
    if (isAssetOfKind(asset, 'scripts') || isAssetOfKind(asset, 'objects')) {
      const gmlFile = asset.gmlFilesArray?.[0];
      file = vscode.Uri.file(
        gmlFile?.path.absolute || this.asset.yyPath.absolute,
      );
    } else if (isAssetOfKind(asset, 'sounds')) {
      file = vscode.Uri.file(asset.dir.join(asset.yy.soundFile).absolute);
    }
    file ||= vscode.Uri.file(this.asset.yyPath.absolute);
    this.command = {
      command: 'vscode.open',
      title: 'Open',
      arguments: [file],
    };

    // If this is a sprite, overwrite the command to
    // open the sprite editor.
    if (isAssetOfKind(asset, 'sprites')) {
      this.command = {
        command: 'stitch.assets.editSprite',
        title: 'Edit Sprite',
        arguments: [this],
      };
    }

    this.collapsibleState = ['objects', 'sprites', 'shaders'].includes(
      this.asset.assetKind,
    )
      ? vscode.TreeItemCollapsibleState.Collapsed
      : vscode.TreeItemCollapsibleState.None;

    this.iconPath = getAssetIcon(this.asset.assetKind, this.asset);
  }
}

export class TreeCode extends StitchTreeItemBase<'code'> {
  override readonly kind = 'code';
  static lookup: Map<Code, TreeCode> = new Map();

  constructor(
    readonly parent: TreeAsset,
    readonly code: Code,
  ) {
    super(code.name);
    this.contextValue = this.kind;
    TreeCode.lookup.set(code, this);

    this.collapsibleState = vscode.TreeItemCollapsibleState.None;
    this.command = {
      command: 'vscode.open',
      title: 'Open',
      arguments: [this.uri],
    };
    this.setIcon();
    this.id = this.parent.id + '/' + this.code.name;

    // Ensure that the tree label is human-friendly.
    this.label = getEventFromFilename(this.uri.fsPath);

    // If no label try to use the @description
    if (!this.label) {
      const key = '/// @description';
      let firstLine = this.getFirstLine(this.uri.fsPath);
      this.label = firstLine.toLowerCase().includes(key) ?
        firstLine.replace(key, '').trim() :
        '';
    }
  }

  private getFirstLine(filePath:string) {
    const fileContent = fs.readFileSync(filePath, 'utf-8');
      return (fileContent.match(/(^.*)/) || [])[1] || '';
  } 

  get uri() {
    return vscode.Uri.file(this.code.path.absolute);
  }

  protected setIcon = setEventIcon;
}

export class TreeSpriteFrame extends StitchTreeItemBase<'sprite-frame'> {
  override readonly kind = 'sprite-frame';
  constructor(
    readonly parent: TreeAsset,
    readonly imagePath: Pathy<Buffer>,
    readonly idx: number,
  ) {
    super(`[${idx}] ${imagePath.name}`);
    this.contextValue = this.kind;
    this.iconPath = vscode.Uri.file(imagePath.absolute);
    this.command = {
      command: 'vscode.open',
      title: 'Open',
      arguments: [this.iconPath],
    };
    this.id = this.parent.id + '/' + this.imagePath.name;
  }
}

export class TreeShaderFile extends StitchTreeItemBase<'shader-file'> {
  override readonly kind = 'shader-file';
  constructor(
    readonly parent: TreeAsset,
    readonly path: Pathy<string>,
  ) {
    super(path.hasExtension('vsh') ? 'Vertex' : 'Fragment');
    this.contextValue = this.kind;
    this.command = {
      command: 'vscode.open',
      title: 'Open',
      arguments: [this.uri],
    };
    this.id = this.parent.id + '/' + this.path.basename;
    this.setFileIcon('shader');
  }
  get uri() {
    return vscode.Uri.file(this.path.absolute);
  }
}
