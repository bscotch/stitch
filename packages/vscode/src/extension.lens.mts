import path from 'node:path';
import vscode from 'vscode';
import type { StitchWorkspace } from './extension.workspace.mjs';
import { assetMainFile } from './tree.items.mjs';

/** Links at the top of an asset's yy file, to its code and other files */
export class StitchLensProvider implements vscode.CodeLensProvider {
  protected constructor(readonly workspace: StitchWorkspace) {}
  provideCodeLenses(
    document: vscode.TextDocument,
  ): vscode.ProviderResult<vscode.CodeLens[]> {
    const asset = this.workspace.getAsset(document);
    if (!asset) return [];
    const topLine = new vscode.Range(0, 0, 0, 0);
    const lenses: vscode.CodeLens[] = [];
    const open = (title: string, file: string, tooltip?: string) =>
      new vscode.CodeLens(topLine, {
        command: 'vscode.open',
        title,
        tooltip,
        arguments: [vscode.Uri.file(file)],
      });
    if (asset.isKind('sprites')) {
      lenses.push(
        new vscode.CodeLens(topLine, {
          command: 'stitch.assets.editSprite',
          title: '$(pencil) Edit Sprite',
          tooltip: 'Open the Sprite Editor',
          arguments: [asset],
        }),
      );
    } else if (asset.isKind('objects')) {
      for (const [idx, { event, file }] of asset.listEvents().entries()) {
        lenses.push(
          open(`${idx === 0 ? '$(go-to-file) ' : ''}${event.label}`, file),
        );
      }
    } else if (asset.isKind('shaders') && asset.shaderPaths) {
      lenses.push(
        open('$(go-to-file) Fragment', asset.shaderPaths.fragment),
        open('Vertex', asset.shaderPaths.vertex),
      );
    } else {
      const file = assetMainFile(asset);
      if (path.resolve(file) !== path.resolve(document.uri.fsPath)) {
        lenses.push(
          open('$(go-to-file) Open Asset', file, 'Open the associated file'),
        );
      }
    }
    return lenses;
  }

  static register(workspace: StitchWorkspace) {
    return vscode.languages.registerCodeLensProvider(
      { language: 'yy', scheme: 'file' },
      new StitchLensProvider(workspace),
    );
  }
}
