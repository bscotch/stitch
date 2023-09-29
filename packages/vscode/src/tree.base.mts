import { Code } from '@bscotch/gml-parser';
import vscode from 'vscode';
import {
  getBaseIcon,
  getFileIcon,
  getGameMakerIcon,
  getObjectEventIcon,
} from './icons.mjs';

// ICONS: See https://code.visualstudio.com/api/references/icons-in-labels#icon-listing

/*
For filtering the tree, there is no native way to add
a searchbar to the tree view and the built-in filter
isn't very good. The appropriate approach based on the docs
and on other extensions is to:
- Add a tree view item per project that represents the filter,
  e.g. the current query string as the item with a search icon button for opening the input dialog and a clear button for resetting the query.
*/

export abstract class StitchTreeItemBase<
  Kind extends string = string,
> extends vscode.TreeItem {
  /** The kind of Node this item is. Also used as the default `contextValue` value */
  readonly kind!: Kind;
  abstract readonly parent: StitchTreeItemBase | undefined;

  constructor(label: string) {
    super(label);
  }

  setBaseIcon(icon: string) {
    this.iconPath = getBaseIcon(icon);
  }

  setFileIcon(icon: string) {
    this.iconPath = getFileIcon(icon as any);
  }

  setGameMakerIcon(icon: string) {
    this.iconPath = getGameMakerIcon(icon as any);
  }
  setObjectEventIcon(icon: string) {
    this.iconPath = getObjectEventIcon(icon);
  }

  toJSON() {
    // Without ensuring json-serializability, drag-n-drop fails for some reason.
    return {
      label: this.label,
      kind: this.kind,
    };
  }
}

export function setEventIcon(this: StitchTreeItemBase & { code: Code }) {
  this.iconPath = getObjectEventIcon(this.code.name);
}
