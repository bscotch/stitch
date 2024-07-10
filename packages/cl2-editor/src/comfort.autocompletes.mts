import vscode from 'vscode';
import { ComfortDocument } from './comfort.doc.mjs';
import { CrashlandsWorkspace } from './workspace.mjs';

export class ComfortCompletionProvider
  implements vscode.CompletionItemProvider
{
  protected constructor(readonly workspace: CrashlandsWorkspace) {}

  provideCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
  ): vscode.ProviderResult<
    vscode.CompletionItem[] | vscode.CompletionList<vscode.CompletionItem>
  > {
    const comfortDoc = ComfortDocument.from(document.uri, this.workspace);
    if (comfortDoc) {
      return comfortDoc.getAutoCompleteItems(position);
    }
    return;
  }

  resolveCompletionItem?(
    item: vscode.CompletionItem,
  ): vscode.ProviderResult<vscode.CompletionItem> {
    return item;
  }

  static register(workspace: CrashlandsWorkspace) {
    const provider = new ComfortCompletionProvider(workspace);
    return [
      vscode.languages.registerCompletionItemProvider(
        { scheme: 'bschema', language: 'cl2-comfort' },
        provider,
        '\t',
        '@',
        '(',
      ),
    ];
  }
}
