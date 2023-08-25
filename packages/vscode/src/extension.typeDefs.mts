import vscode from 'vscode';
import type { StitchWorkspace } from './extension.workspace.mjs';
import { locationOf } from './lib.mjs';

export class StitchTypeDefinitionProvider
  implements vscode.TypeDefinitionProvider
{
  constructor(readonly workspace: StitchWorkspace) {}

  provideTypeDefinition(
    document: vscode.TextDocument,
    position: vscode.Position,
  ): vscode.ProviderResult<vscode.Definition | vscode.LocationLink[]> {
    const offset = document.offsetAt(position);
    const file = this.workspace.getGmlFile(document);
    const ref = file?.getReferenceAt(offset);
    const item = ref?.item;
    if (!item) return;

    // Get the types associated with this item that have associated signifiers.
    const typeSignifiers = item.type.type
      .map((t) => {
        if (t.signifier?.def?.file) {
          return locationOf(t.signifier!.def!);
        }
        return;
      })
      .filter((x) => !!x) as vscode.Location[];
    return typeSignifiers;
  }

  static register(workspace: StitchWorkspace) {
    const provider = new StitchTypeDefinitionProvider(workspace);
    return [
      vscode.languages.registerTypeDefinitionProvider(
        { language: 'gml', scheme: 'file' },
        provider,
      ),
    ];
  }
}
