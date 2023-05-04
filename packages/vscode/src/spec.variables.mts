import vscode from 'vscode';
import { GmlSpec as GmlSpecType } from './spec.schemas.mjs';

export type GmlVariableType = GmlSpecType['variables'][number];

export class GmlVariable {
  readonly docs = new vscode.MarkdownString();
  readonly hover: vscode.Hover;
  readonly completion: vscode.CompletionItem;

  constructor(readonly definition: GmlVariableType) {
    // Update docs
    this.docs.appendCodeblock(this.name, 'gml');
    this.docs.appendMarkdown(this.description);

    // Update completion
    this.completion = new vscode.CompletionItem(
      this.name,
      this.writable
        ? vscode.CompletionItemKind.Variable
        : vscode.CompletionItemKind.Constant,
    );
    this.completion.documentation = this.description;

    // Update hover
    this.hover = new vscode.Hover(this.docs);
  }

  /** Whether or not this is an instance variable. */
  get instance() {
    return this.definition.instance;
  }

  get name() {
    return this.definition.name;
  }

  get description() {
    return this.definition.description || 'A GML variable.';
  }

  get writable() {
    return this.definition.writable;
  }
}
