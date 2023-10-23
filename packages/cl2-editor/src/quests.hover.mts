import vscode from 'vscode';
import { QuestDocument } from './quests.doc.mjs';
import { CrashlandsWorkspace } from './workspace.mjs';

export class QuestHoverProvider implements vscode.HoverProvider {
  provideHover(
    document: vscode.TextDocument,
    position: vscode.Position,
  ): vscode.ProviderResult<vscode.Hover> {
    const questDoc = QuestDocument.from(document.uri, this.workspace);
    if (questDoc) {
      return questDoc.getHover(position);
    }
    return;
  }

  protected constructor(readonly workspace: CrashlandsWorkspace) {}
  static register(workspace: CrashlandsWorkspace) {
    const provider = new QuestHoverProvider(workspace);
    return [
      vscode.languages.registerHoverProvider(
        { scheme: 'bschema', language: 'cl2-quest' },
        provider,
      ),
    ];
  }
}
