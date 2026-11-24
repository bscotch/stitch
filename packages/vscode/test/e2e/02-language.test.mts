import assert from 'node:assert/strict';
import vscode from 'vscode';
import {
  completionLabels,
  getWorkspace,
  hoverText,
  openDocument,
  positionOf,
  projectUri,
  revert,
  setText,
  waitFor,
  workspaceSymbolNames,
} from './lib.mjs';

const exec = vscode.commands.executeCommand;

describe('Language features', function () {
  let script1: vscode.TextDocument;
  const script1Path = ['scripts', 'Script1', 'Script1.gml'] as const;

  before(async function () {
    script1 = await openDocument(...script1Path);
  });

  it('shows hovers', async function () {
    const hovers = await exec<vscode.Hover[]>(
      'vscode.executeHoverProvider',
      script1.uri,
      positionOf(script1, 'global_function', 1),
    );
    const text = hoverText(hovers);
    assert.match(text, /function global_function\(/);
    assert.match(text, /A global function!/);
  });

  it('goes to definitions, including of assets', async function () {
    const uriOf = (d: vscode.Location | vscode.LocationLink) =>
      'uri' in d ? d.uri : d.targetUri;
    const defs = await exec<(vscode.Location | vscode.LocationLink)[]>(
      'vscode.executeDefinitionProvider',
      script1.uri,
      positionOf(script1, 'global_function', 1),
    );
    assert.equal(uriOf(defs[0]).fsPath, script1.uri.fsPath);

    const objectDefs = await exec<(vscode.Location | vscode.LocationLink)[]>(
      'vscode.executeDefinitionProvider',
      script1.uri,
      positionOf(script1, 'o_parent'),
    );
    assert.match(uriOf(objectDefs[0]).fsPath, /o_parent[\\/]Create_0\.gml$/);
  });

  it('goes from event_inherited() to the parent event', async function () {
    const child = await openDocument('objects', 'o_child1', 'Create_0.gml');
    const defs = await exec<vscode.Location[]>(
      'vscode.executeDefinitionProvider',
      child.uri,
      positionOf(child, 'event_inherited'),
    );
    assert.match(defs[0].uri.fsPath, /o_parent[\\/]Create_0\.gml$/);
  });

  it('finds references and renames symbols', async function () {
    const refs = await exec<vscode.Location[]>(
      'vscode.executeReferenceProvider',
      script1.uri,
      positionOf(script1, 'global_function'),
    );
    assert.ok(refs.length >= 2);
    const edit = await exec<vscode.WorkspaceEdit>(
      'vscode.executeDocumentRenameProvider',
      script1.uri,
      positionOf(script1, 'global_function'),
      'renamed_function',
    );
    const edits = edit.entries().flatMap(([, e]) => e);
    assert.equal(edits.length, refs.length);
  });

  it('refuses to rename built-ins and assets', async function () {
    const document = await openDocument('scripts', 'Withing', 'Withing.gml');
    await setText(document, 'show_debug_message(o_parent);\n');
    try {
      for (const needle of ['show_debug_message', 'o_parent']) {
        await assert.rejects(
          Promise.resolve(
            exec(
              'vscode.executeDocumentRenameProvider',
              document.uri,
              positionOf(document, needle),
              'x',
            ),
          ),
          `${needle} can't be renamed`,
        );
      }
    } finally {
      await revert(document);
    }
  });

  it('completes symbols that are in scope, and only those', async function () {
    const all = completionLabels(
      await exec<vscode.CompletionList>(
        'vscode.executeCompletionItemProvider',
        script1.uri,
        positionOf(script1, 'global_function', 1, 4),
      ),
    );
    assert.ok(all.includes('global_function'));

    // Inside global_function: its parameters, but not another function's
    // local or a file-level local (GML functions don't see outer locals)
    const inFunction = completionLabels(
      await exec<vscode.CompletionList>(
        'vscode.executeCompletionItemProvider',
        script1.uri,
        positionOf(script1, 'global.GLOBAL_FUNCTION_VAR', 0, 0),
      ),
    );
    assert.ok(inFunction.includes('something'));
    assert.ok(!inFunction.includes('local'));
    assert.ok(!inFunction.includes('const'));
  });

  it('shows signature help, also in the status bar', async function () {
    const call = 'global.global_function(';
    const position = positionOf(script1, call, 0, call.length);
    const help = await exec<vscode.SignatureHelp>(
      'vscode.executeSignatureHelpProvider',
      script1.uri,
      position,
    );
    assert.match(help.signatures[0].label, /^function global_function\(/);

    const workspace = await getWorkspace();
    const editor = await vscode.window.showTextDocument(script1);
    editor.selection = new vscode.Selection(position, position);
    const status = await waitFor(() => workspace.signatureHelpStatus.text, {
      label: 'the signature status',
    });
    assert.equal(status, 'global_function(SOMETHING, something_else)');
  });

  it('provides semantic tokens', async function () {
    const tokens = await exec<vscode.SemanticTokens>(
      'vscode.provideDocumentSemanticTokens',
      script1.uri,
    );
    assert.ok(tokens.data.length > 0);
  });

  it('describes the symbol at a position (stitch/symbolInfo)', async function () {
    const workspace = await getWorkspace();
    const info = await workspace.getSymbolInfo(
      script1,
      positionOf(script1, 'o_parent'),
    );
    assert.equal(info?.kind, 'asset');
    assert.equal(info?.assetKind, 'objects');
  });

  it('formats documents', async function () {
    const document = await openDocument('scripts', 'Futures', 'Futures.gml');
    await setText(document, 'var a=1\nif(a){b=2}\n');
    try {
      const edits = await exec<vscode.TextEdit[]>(
        'vscode.executeFormatDocumentProvider',
        document.uri,
        { tabSize: 4, insertSpaces: false },
      );
      assert.ok(edits?.length);
      const edit = new vscode.WorkspaceEdit();
      edit.set(document.uri, edits);
      await vscode.workspace.applyEdit(edit);
      assert.match(document.getText(), /^var a = 1;\nif \(a\)/);
    } finally {
      await revert(document);
    }
  });

  it('finds workspace symbols, with locals of the active file only', async function () {
    assert.ok(
      (await workspaceSymbolNames('glofun')).includes('global_function'),
    );
    assert.ok((await workspaceSymbolNames('o_child1')).includes('o_child1'));

    const other = await vscode.workspace.openTextDocument(
      projectUri('scripts', 'Futures', 'Futures.gml'),
    );
    await setText(other, 'var zz_other_local = 1;\n');
    await setText(script1, script1.getText() + '\nvar zz_active_local = 1;\n');
    try {
      await vscode.window.showTextDocument(script1);
      let names = await waitFor(async () => {
        const n = await workspaceSymbolNames('zz_');
        return n.includes('zz_active_local') && n;
      });
      assert.ok(!names.includes('zz_other_local'));

      await vscode.window.showTextDocument(other);
      names = await waitFor(async () => {
        const n = await workspaceSymbolNames('zz_');
        return n.includes('zz_other_local') && n;
      });
      assert.ok(!names.includes('zz_active_local'));
    } finally {
      await revert(other);
      await revert(script1);
    }
  });
});
