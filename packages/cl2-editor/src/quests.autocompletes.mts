import vscode from 'vscode';
import { QuestDocument } from './quests.doc.mjs';
import { CrashlandsWorkspace } from './workspace.mjs';

export class QuestCompletionProvider implements vscode.CompletionItemProvider {
  protected constructor(readonly workspace: CrashlandsWorkspace) {}

  provideCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
  ): vscode.ProviderResult<
    vscode.CompletionItem[] | vscode.CompletionList<vscode.CompletionItem>
  > {
    const questDoc = QuestDocument.from(document.uri, this.workspace);
    if (questDoc) {
      return questDoc.getAutoCompleteItems(position);
    }
    return;
  }

  resolveCompletionItem?(
    item: vscode.CompletionItem,
  ): vscode.ProviderResult<vscode.CompletionItem> {
    return item;
  }

  static register(workspace: CrashlandsWorkspace) {
    const provider = new QuestCompletionProvider(workspace);
    return [
      vscode.languages.registerCompletionItemProvider(
        { scheme: 'bschema', language: 'cl2-quest' },
        provider,
        '\t',
      ),
    ];
  }
}
