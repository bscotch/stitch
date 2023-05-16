import { Location } from '@bscotch/gml-parser';
import { Pathy } from '@bscotch/pathy';
import vscode from 'vscode';

export function pathyFromUri(uri: vscode.TextDocument | vscode.Uri): Pathy {
  return new Pathy(uri instanceof vscode.Uri ? uri.fsPath : uri.uri.fsPath);
}

export function locationOf(thing: {
  start: number;
  end: number;
  location?: Location;
}): vscode.Location | undefined {
  if (!thing.location) {
    return;
  }
  // Get a vscode.Range from the thing
  return new vscode.Location(
    vscode.Uri.file(thing.location.file.path.absolute),
    new vscode.Range(
      new vscode.Position(
        thing.location.startLine - 1,
        thing.location.startColumn - 1,
      ),
      new vscode.Position(thing.location.endLine - 1, thing.location.endColumn),
    ),
  );
}
