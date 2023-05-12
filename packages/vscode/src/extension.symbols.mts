import vscode from 'vscode';
import type { GameMakerProject } from './extension.project.mjs';

export class GameMakerWorkspaceSymbolProvider
  implements vscode.WorkspaceSymbolProvider
{
  constructor(readonly projects: GameMakerProject[]) {}

  provideWorkspaceSymbols(
    query: string,
  ): vscode.ProviderResult<vscode.SymbolInformation[]> {
    const symbols: vscode.SymbolInformation[] = [];
    const matcher = new RegExp(query.split('').join('.*'), 'i');
    for (const project of this.projects) {
      for (const [name, resource] of project.resources) {
        if (!matcher.test(name)) {
          continue;
        }
        // symbols.push(...resource.workspaceSymbols());
      }
      // project.definitions.forEach((loc, name) => {
      //   if (matcher.test(name)) {
      //     symbols.push(
      //       new vscode.SymbolInformation(
      //         name,
      //         vscode.SymbolKind.Variable,
      //         loc.range,
      //         loc.uri,
      //       ),
      //     );
      //   }
      // });
    }
    return symbols;
  }
}
