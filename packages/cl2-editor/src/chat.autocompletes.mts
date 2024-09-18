import vscode from 'vscode';
import { ChatDocument } from './chat.doc.mjs';
import { CrashlandsWorkspace } from './workspace.mjs';

export class ChatCompletionProvider implements vscode.CompletionItemProvider {
  protected constructor(readonly workspace: CrashlandsWorkspace) {}

  provideCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
  ): vscode.ProviderResult<
    vscode.CompletionItem[] | vscode.CompletionList<vscode.CompletionItem>
  > {
    const comfortDoc = ChatDocument.from(document.uri, this.workspace);
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
    const provider = new ChatCompletionProvider(workspace);
    return [
      vscode.languages.registerCompletionItemProvider(
        { scheme: 'bschema', language: 'cl2-chat' },
        provider,
        '(',
      ),
    ];
  }
}
