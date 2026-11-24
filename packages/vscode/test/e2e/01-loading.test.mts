import assert from 'node:assert/strict';
import path from 'node:path';
import vscode from 'vscode';
import {
  getProject,
  getWorkspace,
  projectDir,
  waitFor,
  workspaceSymbolNames,
} from './lib.mjs';

describe('Loading', function () {
  it('loads the project from a subfolder, ignoring prefabs', async function () {
    const project = await getProject();
    assert.equal(
      path.normalize(project.yypPath.absolute).toLowerCase(),
      path.join(projectDir, 'project.yyp').toLowerCase(),
    );
  });

  it('starts the language server and analyzes the project', async function () {
    const project = await getProject();
    await waitFor(() => project.client?.isRunning(), {
      label: 'the language client',
    });
    // Requests wait for analysis to finish
    assert.ok((await workspaceSymbolNames('global_function')).length);
  });

  it('publishes diagnostics', async function () {
    const files = await waitFor(
      () =>
        vscode.languages
          .getDiagnostics()
          .filter(([, diagnostics]) => diagnostics.length).length,
      { label: 'diagnostics' },
    );
    assert.ok(files > 0);
    for (const [, diagnostics] of vscode.languages.getDiagnostics()) {
      for (const d of diagnostics) assert.equal(d.source, 'stitch');
    }
  });

  it('registers its commands', async function () {
    await getWorkspace();
    const commands = await vscode.commands.getCommands(true);
    for (const command of [
      'stitch.assets.newEvent',
      'stitch.assets.rename',
      'stitch.assets.editSprite',
      'stitch.openDocs',
      'stitch.run',
      'stitch.spriteSource.import',
      'stitch.types.copy',
    ]) {
      assert.ok(commands.includes(command), `${command} is registered`);
    }
  });
});
