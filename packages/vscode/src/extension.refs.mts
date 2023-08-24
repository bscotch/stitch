import vscode from 'vscode';
import type { StitchWorkspace } from './extension.workspace.mjs';
import { locationOf } from './lib.mjs';

export class StitchReferenceProvider implements vscode.ReferenceProvider {
  constructor(readonly workspace: StitchWorkspace) {}

  provideReferences(
    document: vscode.TextDocument,
    position: vscode.Position,
  ): vscode.ProviderResult<vscode.Location[]> {
    const symbol = this.workspace.getSignifier(document, position);
    if (!symbol) {
      return;
    }
    return [...symbol.refs.values()]
      .map((ref) => {
        const range = locationOf(ref);
        if (!range) return;
        return range;
      })
      .filter((loc) => !!loc) as vscode.Location[];
  }

  static register(workspace: StitchWorkspace) {
    const provider = new StitchReferenceProvider(workspace);
    return [
      vscode.languages.registerReferenceProvider(
        { language: 'gml', scheme: 'file' },
        provider,
      ),
    ];
  }
}
