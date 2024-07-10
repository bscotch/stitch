import { isComfortMote, isQuestMote, isStorylineMote } from '@bscotch/gcdata';
import vscode from 'vscode';
import { QuestDocument } from './quests.doc.mjs';
import { hasEditor, moteToUri } from './quests.util.mjs';
import { CrashlandsWorkspace } from './workspace.mjs';

export class SymbolProvider implements vscode.WorkspaceSymbolProvider {
  provideWorkspaceSymbols(query: string): vscode.SymbolInformation[] {
    const matcher = query ? new RegExp(query.split('').join('.*'), 'i') : /.*/;
    const symbols = this.workspace.packed.working
      .listMotes()
      .map((mote) => {
        if (!hasEditor(mote)) {
          return;
        }
        const name = `${this.workspace.packed.working.getMoteName(mote)!} (${
          mote.id
        })`;
        const symbol = new vscode.SymbolInformation(
          name,
          isQuestMote(mote)
            ? vscode.SymbolKind.String
            : isStorylineMote(mote)
              ? vscode.SymbolKind.Class
              : isComfortMote(mote)
                ? vscode.SymbolKind.Array
                : vscode.SymbolKind.Class,
          isQuestMote(mote)
            ? 'quest'
            : isStorylineMote(mote)
              ? 'storyline'
              : isComfortMote(mote)
                ? 'comfort'
                : 'unknown',
          new vscode.Location(moteToUri(mote), new vscode.Position(0, 0)),
        );
        return symbol;
      })
      .filter((s) => s && matcher.test(s.name)) as vscode.SymbolInformation[];

    return symbols;
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
    const provider = new SymbolProvider(workspace);
    return [vscode.languages.registerWorkspaceSymbolProvider(provider)];
  }
}
