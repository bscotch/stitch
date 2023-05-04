import vscode from 'vscode';
import { GmlSpec as GmlSpecType } from './spec.schemas.mjs';

export type GmlTypeType = GmlSpecType['types'][number];

export class GmlType {
  readonly docs = new vscode.MarkdownString();
  readonly hover: vscode.Hover;
  readonly completion: vscode.CompletionItem;

  constructor(readonly definition: GmlTypeType) {
    // Update docs
    this.docs.appendText('A GameMaker datatype.');

    // Update completion
    this.completion = new vscode.CompletionItem(
      this.name,
      vscode.CompletionItemKind.Constant,
    );

    // Update hover
    this.hover = new vscode.Hover(this.docs);
  }

  get name() {
    return this.definition;
  }
}
