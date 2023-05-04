import vscode from 'vscode';
import { GmlSpec as GmlSpecType } from './spec.schemas.mjs';

export type GmlConstantType = GmlSpecType['constants'][number];

export class GmlConstant {
  readonly docs = new vscode.MarkdownString();
  readonly hover: vscode.Hover;
  readonly completion: vscode.CompletionItem;

  constructor(readonly definition: GmlConstantType) {
    // Update docs
    this.docs.appendCodeblock(this.name, 'gml');
    this.docs.appendMarkdown(this.description);

    // Update completion
    this.completion = new vscode.CompletionItem(
      this.name,
      vscode.CompletionItemKind.Constant,
    );
    this.completion.documentation = this.description;

    // Update hover
    this.hover = new vscode.Hover(this.docs);
  }

  get name() {
    return this.definition.name;
  }

  get description() {
    return this.definition.description || 'A GML constant.';
  }
}
