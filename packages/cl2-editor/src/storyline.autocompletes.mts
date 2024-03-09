import vscode from 'vscode';
import { StorylineDocument } from './storyline.doc.mjs';
import { CrashlandsWorkspace } from './workspace.mjs';

export class StorylineCompletionProvider
  implements vscode.CompletionItemProvider
{
  protected constructor(readonly workspace: CrashlandsWorkspace) {}

  provideCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
  ): vscode.ProviderResult<
    vscode.CompletionItem[] | vscode.CompletionList<vscode.CompletionItem>
  > {
    const storylineDoc = StorylineDocument.from(document.uri, this.workspace);
    if (storylineDoc) {
      return storylineDoc.getAutoCompleteItems(position);
    }
    return;
  }

  resolveCompletionItem?(
    item: vscode.CompletionItem,
  ): vscode.ProviderResult<vscode.CompletionItem> {
    return item;
  }

  static register(workspace: CrashlandsWorkspace) {
    const provider = new StorylineCompletionProvider(workspace);
    return [
      vscode.languages.registerCompletionItemProvider(
        { scheme: 'bschema', language: 'cl2-storyline' },
        provider,
        '\t',
        '@',
        '(',
      ),
    ];
  }
}
