import type { Code, Range } from '@bscotch/gml-parser';
import { Pathy, pathy } from '@bscotch/pathy';
import vscode from 'vscode';
import { assertInternalClaim, assertLoudly, logThrown } from './assert.mjs';
import type { GameMakerProject } from './extension.project.mjs';
import type { StitchWorkspace } from './extension.workspace.mjs';
import type { CommandName } from './manifest.commands.mjs';
import { GameMakerFolder } from './tree.folder.mjs';

export function getWorkspaceRoot() {
  const root =
    vscode.workspace.workspaceFile?.fsPath ||
    vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (!root) {
    throw new Error('Not in a workspace!');
  }
  return root;
}

/**
 * Convert a workspace-root-relative path to an absolute one.
 */
export function getAbsoluteWorkspacePath(relativePath: string): Pathy {
  return pathy(relativePath, getWorkspaceRoot());
}

/** Convert a path into a workspace-root-relative path */
export function getRelativeWorkspacePath(
  path: Pathy | string | vscode.Uri,
): string {
  const normalizedPath = pathy(path instanceof vscode.Uri ? path.fsPath : path);
  return normalizedPath.relativeFrom(getWorkspaceRoot());
}

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
  workspace: StitchWorkspace,
  uriOrFolder: string[] | GameMakerFolder | undefined,
): GameMakerProject | undefined {
  // Identify the target project
  let project: GameMakerProject | undefined;
  if (workspace.projects.length === 1) {
    project = workspace.projects[0];
  } else if (uriOrFolder instanceof GameMakerFolder) {
    // Then we clicked in the tree view
    project = workspace.projects.find((p) => p.name === uriOrFolder.name);
  } else {
    const uriString =
      uriOrFolder?.[0] ||
      vscode.window.activeTextEditor?.document.uri.toString();
    if (uriString) {
      const uri = vscode.Uri.parse(uriString);
      project = workspace.getProject(uri);
    }
  }
  return project;
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

export function sortAlphaInsensitive(a: string, b: string) {
  return a.toLocaleLowerCase().localeCompare(b.toLocaleLowerCase());
}

export function createSorter<T extends string | undefined>(
  options: {
    sortByField?: T;
    caseSensitive?: boolean;
    first?: string[];
  } = {},
) {
  type Entry = T extends string ? { [key in T]: string } : string;
  const normalizer = (entry: Entry) => {
    const value =
      typeof entry === 'string'
        ? entry
        : options?.sortByField && typeof entry === 'object' && entry !== null
        ? entry[options.sortByField as any]
        : `${entry}`;
    return options?.caseSensitive ? value : value.toLocaleLowerCase();
  };

  return (_a: Entry, _b: Entry) => {
    const a = normalizer(_a);
    const b = normalizer(_b);
    for (const first of options.first || []) {
      if (a === first) return -1;
      if (b === first) return 1;
    }
    return a.localeCompare(b);
  };
}

export function toKebabCase(text: string) {
  return text
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/[\s_]+/g, '-')
    .toLowerCase();
}
