import type { Code, Range } from '@bscotch/gml-parser';
import { Pathy, pathy } from '@bscotch/pathy';
import vscode from 'vscode';
import { assertInternalClaim, assertLoudly, logThrown } from './assert.mjs';
import type { GameMakerProject } from './extension.project.mjs';
import type { StitchWorkspace } from './extension.workspace.mjs';
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
  provider: StitchWorkspace,
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

export async function openPath(
  path: string | Pathy,
  options?: { assertLoudly?: boolean },
) {
  path = pathy(path);
  // Does it exist?
  const exists = await path.exists();
  if (!exists) {
    const msg = `Path does not exist: "${path.absolute}"`;
    if (options?.assertLoudly) {
      assertLoudly(exists, msg);
    } else {
      assertInternalClaim(exists, msg);
    }
  }
  // Is it a file or a folder?
  const isFile = await path.isFile();
  if (isFile) {
    await vscode.commands.executeCommand(
      'vscode.open',
      vscode.Uri.file(path.absolute),
    );
  } else {
    await vscode.commands.executeCommand(
      'vscode.openFolder',
      vscode.Uri.file(path.absolute),
      { forceNewWindow: true },
    );
  }
}

export async function showProgress<T extends (...args: any[]) => any>(
  func: T,
  title: string,
): Promise<ReturnType<T>> {
  return await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title,
      cancellable: false,
    },
    async (progress) => {
      progress.report({
        increment: 0,
      });
      const results = await func();
      progress.report({
        increment: 100,
      });
      return results;
    },
  );
}

/**
 * A tagged template that doesn't do anything interesting, but
 * allows indicating that the template is HTML.
 */
export function html(
  strings: TemplateStringsArray,
  ...values: unknown[]
): string {
  const allStrings: string[] = [];
  for (let i = 0; i < strings.length; i++) {
    allStrings.push(strings[i]);
    if (i < values.length) {
      const value = values[i];
      allStrings.push(Array.isArray(value) ? value.join(' ') : String(value));
    }
  }
  return allStrings.join('');
}
