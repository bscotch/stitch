import { GameMakerFolder } from 'tree.folder.mjs';
import vscode from 'vscode';
import { swallowThrown } from './assert.mjs';
import { StitchCompletionProvider } from './extension.completions.mjs';
import { config } from './extension.config.mjs';
import {
  createCopyAsJsdocSelfCallback,
  createCopyAsJsdocTypeCallback,
  createCopyAsTypeCallback,
} from './extension.copyType.mjs';
import { StitchDefinitionsProvider } from './extension.definitions.mjs';
import { StitchYyFormatProvider } from './extension.formatting.mjs';
import { GameMakerHoverProvider } from './extension.hover.mjs';
import { StitchWorkspaceSymbolProvider } from './extension.symbols.mjs';
import type { StitchWorkspace } from './extension.workspace.mjs';
import { GameMakerInspectorProvider } from './inspector.mjs';
import { findProject, pathyFromUri, registerCommand } from './lib.mjs';
import { Timer, info, logger, warn } from './log.mjs';
import { GameMakerTreeProvider } from './tree.mjs';

export async function activateStitchExtension(
  provider: StitchWorkspace,
  ctx: vscode.ExtensionContext,
) {
  info('Activating extension...');
  const t = Timer.start();
  // Ensure that things stay up to date!

  // Dispose any existing subscriptions
  // to allow for reloading the extension
  ctx.subscriptions.forEach((s) => s.dispose());

  provider.clearProjects();

  info('Loading projects...');
  const yypFiles = await vscode.workspace.findFiles(`**/*.yyp`);
  if (!yypFiles.length) {
    warn('No .yyp files found in workspace!');
  }
  for (const yypFile of yypFiles) {
    info('Loading project', yypFile);
    const pt = Timer.start();
    try {
      await provider.loadProject(
        yypFile,
        provider.emitDiagnostics.bind(provider),
      );
      pt.seconds('Loaded project in');
    } catch (error) {
      logger.error('Error loading project', yypFile, error);
      vscode.window.showErrorMessage(
        `Could not load project ${pathyFromUri(yypFile).basename}`,
      );
    }
  }
  const watcher = vscode.workspace.createFileSystemWatcher('**/*.{gml,yy,yyp}');

  const treeProvider = new GameMakerTreeProvider(provider);
  const inspectorProvider = new GameMakerInspectorProvider(provider);
  const definitionsProvider = new StitchDefinitionsProvider(provider);

  ctx.subscriptions.push(
    // vscode.window.onDidChangeActiveTextEditor((editor) => {
    //   if (!editor) {
    //     return;
    //   }
    //   const code = provider.getGmlFile(editor.document);
    // }),
    vscode.workspace.onDidChangeTextDocument((event) =>
      provider.onChangeDoc(event),
    ),
    vscode.workspace.onDidOpenTextDocument((event) => {
      // provider.onChangeDoc(event),
    }),
    watcher.onDidCreate((uri) => {
      provider.externalChangeTracker.addChange({ uri, type: 'create' });
    }),
    watcher.onDidDelete((uri) => {
      provider.externalChangeTracker.addChange({ uri, type: 'delete' });
    }),
    watcher.onDidChange((uri) => {
      provider.externalChangeTracker.addChange({ uri, type: 'change' });
    }),
    ...treeProvider.register(),
    ...inspectorProvider.register(),
    definitionsProvider.register(),
    GameMakerHoverProvider.register(provider),
    StitchWorkspaceSymbolProvider.register(provider),
    StitchCompletionProvider.register(provider),
    vscode.languages.registerSignatureHelpProvider('gml', provider, '(', ','),
    vscode.languages.registerDocumentFormattingEditProvider(
      'yy',
      new StitchYyFormatProvider(),
    ),
    vscode.languages.registerReferenceProvider('gml', provider),

    registerCommand('stitch.types.copy', createCopyAsTypeCallback(provider)),
    registerCommand(
      'stitch.types.copyAsJsdocSelf',
      createCopyAsJsdocSelfCallback(provider),
    ),
    registerCommand(
      'stitch.types.copyAsJsdocType',
      createCopyAsJsdocTypeCallback(provider),
    ),
    registerCommand('stitch.run', (uriOrFolder: string[] | GameMakerFolder) => {
      const project = findProject(provider, uriOrFolder);
      if (!project) {
        void vscode.window.showErrorMessage('No project found to run!');
        return;
      }
      project.run();
    }),
    registerCommand(
      'stitch.clean',
      (uriOrFolder: string[] | GameMakerFolder) => {
        const project = findProject(provider, uriOrFolder);
        if (!project) {
          void vscode.window.showErrorMessage('No project found to run!');
          return;
        }
        project.run({ clean: true });
      },
    ),
    registerCommand('stitch.openIde', (...args) => {
      const uri = vscode.Uri.parse(
        args[0] || vscode.window.activeTextEditor?.document.uri.toString(),
      );
      provider.getProject(uri)?.openInIde();
    }),
    provider.semanticHighlightProvider.register(),
    provider.signatureHelpStatus,
    vscode.window.onDidChangeTextEditorSelection((e) => {
      // This includes events from the output window, so skip those
      if (e.textEditor.document.uri.scheme !== 'file') {
        return;
      }
      provider.signatureHelpStatus.text = '';
      provider.signatureHelpStatus.hide();
      if (!config.enableFunctionSignatureStatus) {
        return;
      }
      // If something is actually selected, versus
      // just the cursor being in a position, then
      // we don't want to do anything.
      if (e.selections.length !== 1) {
        return;
      }
      // Get the signature helper.
      const signatureHelp = swallowThrown(
        () =>
          provider.provideSignatureHelp(
            e.textEditor.document,
            e.selections[0].start,
          )!,
      );
      if (!signatureHelp) {
        return;
      }
      // Update the status bar with the signature.
      // We can't do any formatting, so we'll need
      // to upper-case the current parameter.
      const signature = signatureHelp.signatures[signatureHelp.activeSignature];
      const name = signature.label.match(/^function\s+([^(]+)/i)?.[1];
      if (!name) {
        return;
      }
      const asString = `${name}(${signature.parameters
        .map((p, i) => {
          if (
            typeof p.label === 'string' &&
            i === signatureHelp.activeParameter
          ) {
            return p.label.toUpperCase();
          }
          return p.label;
        })
        .join(', ')})`;
      provider.signatureHelpStatus.text = asString;
      provider.signatureHelpStatus.show();
    }),
    provider.diagnosticCollection,
  );

  t.seconds('Extension activated in');
  return provider;
}
