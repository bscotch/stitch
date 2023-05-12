import { Location } from '@bscotch/gml-parser';
import { Pathy } from '@bscotch/pathy';
import vscode from 'vscode';

export function pathyFromUri(uri: vscode.TextDocument | vscode.Uri): Pathy {
  return new Pathy(uri instanceof vscode.Uri ? uri.fsPath : uri.uri.fsPath);
}

export function locationOf(
  thing: { startOffset: number; endOffset: number; location?: Location },
  inDocument: vscode.TextDocument,
): vscode.Location | undefined {
  if (!thing.location) {
    return;
  }
  return new vscode.Location(
    vscode.Uri.file(thing.location.file.path.absolute),
    new vscode.Range(
      inDocument.positionAt(thing.startOffset),
      inDocument.positionAt(thing.endOffset),
    ),
  );
}
