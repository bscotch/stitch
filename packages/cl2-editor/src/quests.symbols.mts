import vscode from 'vscode';
import { QuestDocument } from './quests.doc.mjs';
import { moteToUri } from './quests.util.mjs';
import { CrashlandsWorkspace } from './workspace.mjs';

export class QuestWorkspaceSymbolProvider
  implements vscode.WorkspaceSymbolProvider
{
  provideWorkspaceSymbols(
    query: string,
  ): vscode.ProviderResult<vscode.SymbolInformation[]> {
    const matcher = query ? new RegExp(query.split('').join('.*'), 'i') : /.*/;
    return this.workspace.packed.working
      .listMotesBySchema('cl2_quest')
      .map((mote) => {
        const name = `${this.workspace.packed.working.getMoteName(mote)!} (${
          mote.id
        })`;
        const symbol = new vscode.SymbolInformation(
          name,
          vscode.SymbolKind.Object,
          'quest',
          new vscode.Location(moteToUri(mote), new vscode.Position(0, 0)),
        );
        return symbol;
      })
      .filter((s) => matcher.test(s.name));
  }

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
    const provider = new QuestWorkspaceSymbolProvider(workspace);
    return [vscode.languages.registerWorkspaceSymbolProvider(provider)];
  }
}
