/**
 * Changing the project (these tests change the sample project, so they run
 * last).
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vscode from 'vscode';
import {
  getProject,
  getWorkspace,
  projectUri,
  treeAsset,
  treeItems,
  waitFor,
  workspaceSymbolNames,
} from './lib.mjs';

describe('Asset tree and project changes', function () {
  it('lists every asset in the tree', async function () {
    const workspace = await getWorkspace();
    const project = await getProject();
    const assets = treeItems(workspace).filter((i) => i.kind === 'asset');
    assert.equal(assets.length, project.gm.assetCount);
  });

  it('follows new assets, in the tree and the language server', async function () {
    const workspace = await getWorkspace();
    const project = await getProject();
    await project.gm.createScript(
      'Tests/scr_e2e',
      'function e2e_new_function() {}\n',
    );
    await waitFor(() => treeAsset(workspace, 'scr_e2e'), {
      label: 'the new script in the tree',
    });
    await waitFor(async () =>
      (await workspaceSymbolNames('e2e_new_function')).includes(
        'e2e_new_function',
      ),
    );
  });

  it('labels collision events with their object (#236, #280)', async function () {
    const workspace = await getWorkspace();
    const project = await getProject();
    const object = project.gm.requireAsset('o_child1', 'objects');
    await project.gm.createObjectEvent(object, 'Collision_o_object');
    const item = await waitFor(() => treeAsset(workspace, 'o_child1'));
    const labels = await waitFor(() => {
      const l = workspace.tree!.getChildren(item)!.map((c) => c.label);
      return l.includes('Collision (o_object)') && l;
    });
    assert.ok(labels.includes('Create'));
  });

  it('renames assets, updating code that refers to them', async function () {
    const workspace = await getWorkspace();
    const project = await getProject();
    const renamed = await workspace.renameAsset(
      project.gm.requireAsset('o_parent'),
      'o_parent_renamed',
    );
    assert.equal(project.gm.getAsset('o_parent_renamed'), renamed);
    const script1 = projectUri('scripts', 'Script1', 'Script1.gml');
    assert.match(
      fs.readFileSync(script1.fsPath, 'utf8'),
      /with o_parent_renamed/,
    );
    await waitFor(() => treeAsset(workspace, 'o_parent_renamed'));
    // The language server follows
    const document = await vscode.workspace.openTextDocument(script1);
    const offset = document.getText().indexOf('o_parent_renamed') + 1;
    await waitFor(async () => {
      const info = await workspace.getSymbolInfo(
        document,
        document.positionAt(offset),
      );
      return info?.kind === 'asset';
    });
  });

  it('deletes assets', async function () {
    const workspace = await getWorkspace();
    const project = await getProject();
    await workspace.deleteAsset(project.gm.requireAsset('scr_e2e'));
    await waitFor(() => !treeAsset(workspace, 'scr_e2e'));
  });

  it('follows changes made outside VS Code (e.g. by git)', async function () {
    const file = projectUri('scripts', 'Reactions', 'Reactions.gml');
    fs.writeFileSync(file.fsPath, 'function e2e_external_function() {}\n');
    await waitFor(async () =>
      (await workspaceSymbolNames('e2e_external_function')).includes(
        'e2e_external_function',
      ),
    );
  });

  it('applies diagnostic settings (#202)', async function () {
    const config = vscode.workspace.getConfiguration('stitch');
    const file = projectUri('scripts', 'Reactions', 'Reactions.gml');
    await config.update(
      'diagnostics.missingDocs',
      'warning',
      vscode.ConfigurationTarget.Global,
    );
    try {
      await waitFor(() =>
        vscode.languages
          .getDiagnostics(file)
          .some((d) => d.code === 'missing-docs'),
      );
    } finally {
      await config.update(
        'diagnostics.missingDocs',
        undefined,
        vscode.ConfigurationTarget.Global,
      );
    }
  });
});
