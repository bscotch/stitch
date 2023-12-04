import vscode from 'vscode';

export abstract class TreeItemBase<
  Kind extends string = string,
> extends vscode.TreeItem {
  /** The kind of Node this item is. Also used as the default `contextValue` value */
  readonly kind!: Kind;

  constructor(label: string) {
    super(label);
  }

  toJSON() {
    // Without ensuring json-serializability, drag-n-drop fails for some reason.
    return {
      label: this.label,
      kind: this.kind,
    };
  }
}
