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
    rangeFrom(thing.location),
  );
}

export function rangeFrom(location: {
  startLine: number;
  startColumn: number;
  endLine: number;
  endColumn: number;
}) {
  return new vscode.Range(
    new vscode.Position(location.startLine - 1, location.startColumn - 1),
    new vscode.Position(location.endLine - 1, location.endColumn),
  );
}
