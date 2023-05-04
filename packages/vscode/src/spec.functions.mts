import vscode from 'vscode';
import { GmlSpec as GmlSpecType } from './spec.schemas.mjs';

export type GmlFunctionType = GmlSpecType['functions'][number];

export class GmlFunction {
  readonly docs = new vscode.MarkdownString();
  readonly hover: vscode.Hover;
  readonly completion: vscode.CompletionItem;
  readonly help = new vscode.SignatureHelp();

  constructor(readonly definition: GmlFunctionType) {
    // Update docs
    this.docs.appendCodeblock(this.signatureString, 'gml');
    if (this.description) {
      this.docs.appendMarkdown(`${this.description}`);
    }

    // Update hover
    this.hover = new vscode.Hover(this.docs);

    // Update completion
    this.completion = new vscode.CompletionItem(
      this.name,
      vscode.CompletionItemKind.Function,
    );

    // Update signature help
    const signature = new vscode.SignatureInformation(
      this.signatureString,
      this.docs,
    );
    signature.parameters = this.parameters.map((p) => {
      const param = new vscode.ParameterInformation(p.name, p.description);
      return param;
    });
    this.help.signatures.push(signature);
  }

  get name() {
    return this.definition.name;
  }

  get description() {
    return this.definition.description;
  }

  get parameters() {
    return this.definition.parameters;
  }

  get signatureString() {
    return `${this.name}(${this.parameters
      .map((a) => {
        let param = a.name;
        if (a.optional) {
          param += '?';
        }
        if (a.type) {
          param += `: ${a.type.join('|')}`;
        }
        return param;
      })
      .join(', ')})`;
  }
}
