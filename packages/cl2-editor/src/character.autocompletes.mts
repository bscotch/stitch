import vscode from 'vscode';
import { CharacterDocument } from './character.doc.mjs';
import { CrashlandsWorkspace } from './workspace.mjs';

export class CharacterCompletionProvider
  implements vscode.CompletionItemProvider
{
  protected constructor(readonly workspace: CrashlandsWorkspace) {}

  provideCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
  ): vscode.ProviderResult<
    vscode.CompletionItem[] | vscode.CompletionList<vscode.CompletionItem>
  > {
    const comfortDoc = CharacterDocument.from(document.uri, this.workspace);
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
    const provider = new CharacterCompletionProvider(workspace);
    return [
      vscode.languages.registerCompletionItemProvider(
        { scheme: 'bschema', language: 'cl2-character' },
        provider,
        '(',
      ),
    ];
  }
}
