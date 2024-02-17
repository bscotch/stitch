import type { Asset, Code, Range, Reference } from '@bscotch/gml-parser';
import { Pathy, pathy } from '@bscotch/pathy';
import { exec } from 'node:child_process';
import os from 'node:os';
import vscode from 'vscode';
import {
  StitchVscodeInternalError,
  assertInternalClaim,
  assertLoudly,
  logThrown,
} from './assert.mjs';
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

export function getAssetFromRef(ref: Reference | undefined): Asset | undefined {
  if (!ref) return;
  const project = ref.file.project;
  return ref.item.asset
    ? project.getAssetByName(ref.item.name)
    : ref.item.def?.file?.asset;
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

export function locationOf(thing: Range | string): vscode.Location | undefined {
  if (typeof thing === 'string') {
    return new vscode.Location(
      vscode.Uri.file(thing),
      new vscode.Position(0, 0),
    );
  }
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

export type Tab = DocTab | ImageTab | AudioTab | SpriteTab;

export interface DocTab {
  kind: 'document';
  uri: vscode.Uri;
  document: vscode.TextDocument;
}

export interface ImageTab {
  kind: 'image';
  uri: vscode.Uri;
}

export interface AudioTab {
  kind: 'audio';
  uri: vscode.Uri;
}

export interface SpriteTab {
  kind: 'sprite';
  assetName: string;
}

export function isDocTab(tab: Tab | undefined): tab is DocTab {
  return tab?.kind === 'document';
}

export function isPngTab(tab: Tab | undefined): tab is ImageTab {
  return tab?.kind === 'image';
}

export function isAudioTab(tab: Tab | undefined): tab is AudioTab {
  return tab?.kind === 'audio';
}

export function isSpriteTab(tab: Tab | undefined): tab is SpriteTab {
  return tab?.kind === 'sprite';
}

export function activeTab(): Tab | undefined {
  const doc = vscode.window.activeTextEditor?.document;
  if (doc) {
    return {
      kind: 'document',
      uri: doc.uri,
      document: doc,
    };
  }
  const tab = vscode.window.tabGroups.activeTabGroup?.activeTab;
  const tabInput = tab?.input as Record<string, any> | undefined;
  if (!tab || !tabInput) return;
  // console.log(tab);
  if ('viewType' in tabInput) {
    if (tabInput.viewType === 'imagePreview.previewEditor') {
      return {
        kind: 'image',
        uri: tabInput.uri,
      };
    } else if (tabInput.viewType === 'vscode.audioPreview') {
      return {
        kind: 'audio',
        uri: tabInput.uri,
      };
    } else if (tabInput.viewType.endsWith('stitch-sprite-editor')) {
      return {
        kind: 'sprite',
        assetName: tab.label,
      };
    }
  }
  console.log('UNKNOWN TAB', tab);
  return;
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

export function assertThrows(
  fn: () => any,
  msg = 'Expected an error to be thrown',
) {
  try {
    fn();
  } catch (e) {
    return;
  }
  throw new StitchVscodeInternalError(msg, assertThrows);
}

export function killProjectRunner(title: string) {
  if (os.platform() !== 'win32') {
    console.warn('killProjectRunner is only supported on Windows');
    return;
  }
  assertInternalClaim(title, 'Title must be provided');
  return new Promise<void>((resolve, reject) => {
    exec(
      `taskkill /FI "WINDOWTITLE eq ${title}" /FI "IMAGENAME eq Runner.exe"`,
      (err) => {
        if (err) {
          return reject(err);
        }
        resolve();
      },
    );
  });
}
