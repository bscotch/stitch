import { isAssetOfKind } from '@bscotch/gml-parser';
import { Pathy } from '@bscotch/pathy';
import vscode from 'vscode';
import type { StitchWorkspace } from './extension.workspace.mjs';

export class StitchLensProvider implements vscode.CodeLensProvider {
  protected constructor(readonly workspace: StitchWorkspace) {}
  provideCodeLenses(
    document: vscode.TextDocument,
  ): vscode.ProviderResult<vscode.CodeLens[]> {
    const matchingAsset = this.workspace.getAsset(document);
    if (!matchingAsset) return [];
    // Put these on the top line
    const topLine = new vscode.Range(0, 0, 0, 0);
    const lenses: vscode.CodeLens[] = [];
    if (isAssetOfKind(matchingAsset, 'sprites')) {
      const command: vscode.Command = {
        command: 'stitch.assets.editSprite',
        title: '$(pencil) Edit Sprite',
        tooltip: 'Open the Sprite Editor',
        arguments: [matchingAsset],
      };
      lenses.push(new vscode.CodeLens(topLine, command));
    } else if (isAssetOfKind(matchingAsset, 'objects')) {
      for (const [idx, file] of matchingAsset.gmlFilesArray.entries()) {
        lenses.push(
          new vscode.CodeLens(topLine, {
            command: 'vscode.open',
            title: `${idx === 0 ? '$(go-to-file) ' : ''}${
              file.objectEventInfo?.label || file.path.name
            }`,
            arguments: [vscode.Uri.file(file.path.absolute)],
          }),
        );
      }
    } else if (isAssetOfKind(matchingAsset, 'shaders')) {
      for (const [idx, fileKind] of (
        ['fragment', 'vertex'] as const
      ).entries()) {
        lenses.push(
          new vscode.CodeLens(topLine, {
            command: 'vscode.open',
            title: `${idx === 0 ? '$(go-to-file) ' : ''}${
              fileKind === 'fragment' ? 'Fragment' : 'Vertex'
            }`,
            arguments: [
              vscode.Uri.file(matchingAsset.shaderPaths?.[fileKind]?.absolute),
            ],
          }),
        );
      }
    } else {
      let path: Pathy | undefined;
      if (matchingAsset.gmlFile || matchingAsset.shaderPaths?.fragment)
        path =
          matchingAsset.gmlFile?.path || matchingAsset.shaderPaths?.fragment;
      else if (isAssetOfKind(matchingAsset, 'sounds'))
        path = matchingAsset.dir.join(matchingAsset.yy.soundFile);
      if (path) {
        const command: vscode.Command = {
          command: 'vscode.open',
          title: '$(go-to-file) Open Asset',
          tooltip: 'Open the associated file',
          arguments: [vscode.Uri.file(path.absolute)],
        };
        lenses.push(new vscode.CodeLens(topLine, command));
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
