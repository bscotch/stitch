import { Code } from '@bscotch/gml-parser';
import path from 'path';
import vscode from 'vscode';

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

  toJSON() {
    // Without ensuring json-serializability, drag-n-drop fails for some reason.
    return {
      label: this.label,
      kind: this.kind,
    };
  }
}

export function setEventIcon(this: StitchTreeItemBase & { code: Code }) {
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
