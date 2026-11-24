/**
 * Helpers for the tests that run inside VS Code.
 */
import assert from 'node:assert/strict';
import path from 'node:path';
import vscode from 'vscode';
import type { StitchWorkspace } from '../../src/extension.workspace.mjs';
import type { Treeable } from '../../src/tree.items.mjs';

/** The copy of the sample project that the tests run on */
export const projectDir = process.env.STITCH_TEST_PROJECT_DIR!;

export function projectUri(...parts: string[]): vscode.Uri {
  return vscode.Uri.file(path.join(projectDir, ...parts));
}

/** Activate the extension (if needed) and get its workspace */
export async function getWorkspace(): Promise<StitchWorkspace> {
  const extension = vscode.extensions.getExtension<{
    workspace: StitchWorkspace;
  }>('bscotch.bscotch-stitch-vscode');
  assert.ok(extension, 'The extension is installed');
  const api = await extension.activate();
  return api.workspace;
}

/** The (only) loaded project */
export async function getProject() {
  const workspace = await getWorkspace();
  assert.equal(workspace.projects.length, 1, 'One project is loaded');
  return workspace.projects[0];
}

/** Retry until `fn` returns something truthy (or time runs out) */
export async function waitFor<T>(
  fn: () => T | Promise<T>,
  options: { timeout?: number; label?: string } = {},
): Promise<Exclude<T, false | null | undefined | 0 | ''>> {
  const end = Date.now() + (options.timeout ?? 15_000);
  let lastError: unknown;
  while (Date.now() < end) {
    try {
      const result = await fn();
      if (result)
        return result as Exclude<T, false | null | undefined | 0 | ''>;
    } catch (err) {
      lastError = err;
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error(
    `Timed out waiting for ${options.label ?? 'a condition'}` +
      (lastError ? `: ${lastError}` : ''),
  );
}

/** The position of the `n`th (0-based) occurrence of `needle`, plus `delta` characters */
export function positionOf(
  document: vscode.TextDocument,
  needle: string,
  n = 0,
  delta = 1,
): vscode.Position {
  const text = document.getText();
  let offset = -1;
  for (let i = 0; i <= n; i++) {
    offset = text.indexOf(needle, offset + 1);
    assert.ok(offset >= 0, `"${needle}" #${n} is in ${document.fileName}`);
  }
  return document.positionAt(offset + delta);
}

export async function openDocument(...parts: string[]) {
  const document = await vscode.workspace.openTextDocument(
    projectUri(...parts),
  );
  await vscode.window.showTextDocument(document);
  return document;
}

/** Replace a document's text (without saving it) */
export async function setText(document: vscode.TextDocument, text: string) {
  const edit = new vscode.WorkspaceEdit();
  edit.replace(
    document.uri,
    new vscode.Range(0, 0, document.lineCount, 0),
    text,
  );
  assert.ok(await vscode.workspace.applyEdit(edit));
}

/** Discard a document's unsaved changes */
export async function revert(document: vscode.TextDocument) {
  await vscode.window.showTextDocument(document);
  await vscode.commands.executeCommand('workbench.action.files.revert');
}

export function hoverText(hovers: vscode.Hover[] | undefined): string {
  return (hovers ?? [])
    .flatMap((h) => h.contents)
    .map((c) => (typeof c === 'string' ? c : c.value))
    .join('\n');
}

export function completionLabels(list: vscode.CompletionList): string[] {
  return list.items.map((i) =>
    typeof i.label === 'string' ? i.label : i.label.label,
  );
}

export async function workspaceSymbolNames(query: string): Promise<string[]> {
  const symbols = await vscode.commands.executeCommand<
    vscode.SymbolInformation[]
  >('vscode.executeWorkspaceSymbolProvider', query);
  return symbols.map((s) => s.name);
}

/** Every item in the asset tree, depth first (not including asset contents) */
export function treeItems(workspace: StitchWorkspace): Treeable[] {
  const tree = workspace.tree!;
  const items: Treeable[] = [];
  const visit = (element?: Treeable) => {
    for (const child of tree.getChildren(element) ?? []) {
      items.push(child);
      if (child.kind === 'folder' || child.kind === 'tree-filter-group') {
        visit(child);
      }
    }
  };
  visit();
  return items;
}

/** The asset tree's item for an asset, if it's there */
export function treeAsset(workspace: StitchWorkspace, name: string) {
  return treeItems(workspace).find(
    (i) => i.kind === 'asset' && i.asset.name === name,
  );
}
