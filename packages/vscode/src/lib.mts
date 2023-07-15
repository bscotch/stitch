import type { Code, Range } from '@bscotch/gml-parser';
import { Pathy } from '@bscotch/pathy';
import vscode from 'vscode';
import { logThrown } from './assert.mjs';
import type { GameMakerProject } from './extension.project.mjs';
import type { StitchProvider } from './extension.provider.mjs';
import type { CommandName } from './manifest.commands.mjs';
import { GameMakerFolder } from './tree.folder.mjs';

export function pathyFromUri(uri: vscode.TextDocument | vscode.Uri): Pathy {
  return new Pathy(uri instanceof vscode.Uri ? uri.fsPath : uri.uri.fsPath);
}

export function uriFromPathy(pathy: Pathy) {
  return vscode.Uri.file(pathy.absolute);
}

export function uriFromCodeFile(file: Code) {
  return vscode.Uri.file(file.path.absolute);
}

export function locationOf(thing: Range): vscode.Location | undefined {
  // Get a vscode.Range from the thing
  return new vscode.Location(
    vscode.Uri.file(thing.file.path.absolute),
    rangeFrom(thing),
  );
}

export function rangeFrom(location: Range) {
  return logThrown(() => {
    return new vscode.Range(
      new vscode.Position(location.start.line - 1, location.start.column - 1),
      new vscode.Position(location.end.line - 1, location.end.column),
    );
  });
}

export function findProject(
  provider: StitchProvider,
  uriOrFolder: string[] | GameMakerFolder,
): GameMakerProject | undefined {
  // Identify the target project
  let project: GameMakerProject | undefined;
  if (provider.projects.length === 1) {
    project = provider.projects[0];
  } else if (uriOrFolder instanceof GameMakerFolder) {
    // Then we clicked in the tree view
    project = provider.projects.find((p) => p.name === uriOrFolder.name);
  } else {
    const uriString =
      uriOrFolder[0] || vscode.window.activeTextEditor?.document.uri.toString();
    if (uriString) {
      const uri = vscode.Uri.parse(uriString);
      project = provider.getProject(uri);
    }
  }
  return project;
}

export function createSorter<T extends string>(sortByField: T) {
  return (a: { [key in T]: string }, b: { [key in T]: string }) => {
    const aValue = a[sortByField]?.toLocaleLowerCase?.();
    const bValue = b[sortByField]?.toLocaleLowerCase?.();
    return aValue?.localeCompare(bValue) || 0;
  };
}

export function registerCommand(
  command: CommandName,
  callback: (...args: any[]) => any,
) {
  return vscode.commands.registerCommand(command, callback);
}

export function copyToClipboard(text: string) {
  vscode.env.clipboard.writeText(text);
}
