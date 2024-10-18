import { Asset, Code } from '@bscotch/gml-parser';
import { literal } from '@bscotch/utility';
import os from 'node:os';
import { GameMakerFolder } from 'tree.folder.mjs';
import vscode from 'vscode';
import { swallowThrown } from './assert.mjs';
import { stitchConfig } from './config.mjs';
import { stitchEvents } from './events.mjs';
import { StitchCompletionProvider } from './extension.completions.mjs';
import {
  createCopyAsJsdocSelfCallback,
  createCopyAsJsdocTypeCallback,
  createCopyAsTypeCallback,
} from './extension.copyType.mjs';
import { StitchDefinitionsProvider } from './extension.definitions.mjs';
import { StitchYyFormatProvider } from './extension.formatting.mjs';
import { StitchHoverProvider } from './extension.hover.mjs';
import { StitchLensProvider } from './extension.lens.mjs';
import { StitchLocationsProvider } from './extension.locations.mjs';
import { StitchReferenceProvider } from './extension.refs.mjs';
import { StitchReleasePickerProvider } from './extension.releases.mjs';
import { StitchRenameProvider } from './extension.rename.mjs';
import { StitchWorkspaceSymbolProvider } from './extension.symbols.mjs';
import { StitchTypeDefinitionProvider } from './extension.typeDefs.mjs';
import type { StitchWorkspace } from './extension.workspace.mjs';
import { StitchIncludedFilesTree } from './includedFilesTree.mjs';
import { GameMakerInspectorProvider } from './inspector.mjs';
import {
  createSorter,
  findProject,
  getAssetFromRef,
  pathyFromUri,
  registerCommand,
} from './lib.mjs';
import {
  Timer,
  getErrorMessage,
  info,
  logger,
  showErrorMessage,
  warn,
} from './log.mjs';
import type { SpriteSourcesTree as SpriteSourcesTreeType } from './spriteSources.mjs';
import { GameMakerTreeProvider } from './tree.mjs';
import { StitchIgorView } from './webview.igor.mjs';
import { StitchSpriteEditorProvider } from './webviews.spriteEditor.mjs';

export async function activateStitchExtension(
  workspace: StitchWorkspace,
  ctx: vscode.ExtensionContext,
) {
  info('Activating extension...');
  stitchConfig.context = ctx;

  const t = Timer.start();
  // Ensure that things stay up to date!

  // Dispose any existing subscriptions
  // to allow for reloading the extension
  ctx.subscriptions.forEach((s) => s.dispose());

  workspace.clearProjects();

  info('Loading projects...');
  const toWatch: vscode.RelativePattern[] = [];

  let yypFiles = await vscode.workspace.findFiles(`**/*.yyp`);
  if (!yypFiles.length) {
    warn('No .yyp files found in workspace!');
  }

  // Only allow loading one project at a time to reduce complexity
  if (yypFiles.length > 1) {
    const chosen = await vscode.window.showQuickPick(
      yypFiles.map((yyp) => ({
        label: pathyFromUri(yyp).basename,
        description: pathyFromUri(yyp).up().absolute,
        uri: yyp,
      })),
      {
        title:
          'Stitch: Multiple GameMaker projects found! Choose a project to load.',
      },
    );
    if (!chosen) yypFiles.length = 0;
    else yypFiles = [chosen.uri];
  }

  for (const yypFile of yypFiles) {
    info('Loading project', yypFile);
    const pt = Timer.start();
    try {
      await workspace.loadProject(
        yypFile,
        workspace.emitDiagnostics.bind(workspace),
      );
      pt.seconds('Loaded project in');
      // Add watcher paths
      const projectFolder = pathyFromUri(yypFile).up();
      const base = vscode.Uri.file(projectFolder.absolute);
      toWatch.push(
        new vscode.RelativePattern(base, '*.yyp'),
        new vscode.RelativePattern(base, '*/*/*.yy'),
        new vscode.RelativePattern(base, '*/*/*.gml'),
        new vscode.RelativePattern(base, '*/*/*.atlas'),
        new vscode.RelativePattern(base, '*/*/*.png'),
        new vscode.RelativePattern(base, 'datafiles/**/*'),
      );
    } catch (error) {
      logger.error(error);
      logger.error('Error loading project', yypFile);
      let message = `Could not load project ${pathyFromUri(yypFile).basename}`;
      const rootCause = getErrorMessage(error);
      if (rootCause) {
        message += ` ← ${rootCause}`;
      }
      showErrorMessage(message);
    }
  }
  const watchers = toWatch.map((pattern) =>
    vscode.workspace.createFileSystemWatcher(pattern),
  );

  const treeProvider = new GameMakerTreeProvider(workspace);
  const inspectorProvider = new GameMakerInspectorProvider(workspace);
  const definitionsProvider = new StitchDefinitionsProvider(workspace);

  // SpriteSources currently only work on Windows, and will cause errors on
  // other platforms. So we'll only register it if we're on Windows.
  let SpriteSourcesTree: typeof SpriteSourcesTreeType | undefined;
  if (os.platform() === 'win32') {
    ({ SpriteSourcesTree } = await import('./spriteSources.mjs'));
  }

  ctx.subscriptions.push(
    // vscode.window.onDidChangeActiveTextEditor((editor) => {
    //   if (!editor) {
    //     return;
    //   }
    //   const code = provider.getGmlFile(editor.document);
    // }),
    vscode.workspace.onDidChangeTextDocument((event) =>
      workspace.onChangeDoc(event),
    ),
    // vscode.workspace.onDidOpenTextDocument((event) => {
    //   // provider.onChangeDoc(event),
    // }),
    ...watchers,
    ...watchers.map((watcher) =>
      watcher.onDidCreate((uri) => {
        workspace.externalChangeTracker.addChange({ uri, type: 'create' });
      }),
    ),
    ...watchers.map((watcher) =>
      watcher.onDidDelete((uri) => {
        workspace.externalChangeTracker.addChange({ uri, type: 'delete' });
      }),
    ),
    ...watchers.map((watcher) =>
      watcher.onDidChange((uri) => {
        workspace.externalChangeTracker.addChange({ uri, type: 'change' });
      }),
    ),
    ...treeProvider.register(),
    ...inspectorProvider.register(),
    ...definitionsProvider.register(),
    ...StitchIncludedFilesTree.register(workspace),
    ...StitchTypeDefinitionProvider.register(workspace),
    ...StitchReleasePickerProvider.register(workspace),
    ...StitchRenameProvider.register(workspace),
    ...(SpriteSourcesTree?.register(workspace) || []),
    StitchHoverProvider.register(workspace),
    StitchLensProvider.register(workspace),
    StitchWorkspaceSymbolProvider.register(workspace),
    StitchCompletionProvider.register(workspace),
    ...StitchIgorView.register(workspace),
    ...StitchSpriteEditorProvider.register(workspace),
    ...StitchReferenceProvider.register(workspace),
    ...StitchLocationsProvider.register(workspace),
    vscode.languages.registerSignatureHelpProvider('gml', workspace, '(', ','),
    vscode.languages.registerDocumentFormattingEditProvider(
      'yy',
      new StitchYyFormatProvider(),
    ),
    registerCommand('stitch.assets.delete', (what) => {
      // Convert the incoming argument to an Asset, then emit the event
      let asset: Asset | undefined;
      if (what && typeof what === 'object') {
        if (what instanceof Asset) {
          asset = what;
        } else if ('asset' in what && what.asset instanceof Asset) {
          asset = what.asset;
        }
      }
      if (!asset) {
        logger.warn('stitch.assets.delete called on unknown type', what);
        return;
      }
      workspace.deleteAsset(asset);
    }),
    registerCommand('stitch.assets.deleteCode', async (what) => {
      // Convert the incoming argument to a Code instance, then emit the event
      let code: Code | undefined;
      if (what && typeof what === 'object') {
        if (what instanceof Code) {
          code = what;
        } else if ('code' in what && what.code instanceof Code) {
          code = what.code;
        }
      }
      // Actually delete the code!
      if (!code) {
        logger.warn('stitch.assets.deleteCode called on unknown type', what);
        return;
      }
      await code.remove();
      stitchEvents.emit('code-file-deleted', code);
    }),
    registerCommand('stitch.types.copy', createCopyAsTypeCallback(workspace)),
    registerCommand(
      'stitch.types.copyAsJsdocSelf',
      createCopyAsJsdocSelfCallback(workspace),
    ),
    registerCommand(
      'stitch.types.copyAsJsdocType',
      createCopyAsJsdocTypeCallback(workspace),
    ),
    registerCommand('stitch.run', (uriOrFolder: string[] | GameMakerFolder) => {
      const project = findProject(workspace, uriOrFolder);
      if (!project) {
        void showErrorMessage('No project found to run!');
        return;
      }
      project.run();
    }),
    registerCommand(
      'stitch.stop',
      (uriOrFolder: string[] | GameMakerFolder) => {
        const project = findProject(workspace, uriOrFolder);
        if (!project) {
          void showErrorMessage('No project found to run!');
          return;
        }
        project.kill();
      },
    ),
    registerCommand(
      'stitch.run.noDefaults',
      async (uriOrFolder: string[] | GameMakerFolder) => {
        const project = findProject(workspace, uriOrFolder);
        if (!project) {
          void showErrorMessage('No project found to run!');
          return;
        }
        // QuickPick to select the config
        const configs = project.configs.sort(
          createSorter({
            first: [stitchConfig.runConfigDefault || '', 'Default'],
          }),
        );
        const chosenConfig = await vscode.window.showQuickPick(configs, {
          title: 'Select a config',
        });
        if (!chosenConfig) return;

        // QuickPick to select the compiler
        const compilers = literal(['vm', 'yyc']).sort(
          createSorter({ first: [stitchConfig.runCompilerDefault] }),
        );
        const chosenCompiler = await vscode.window.showQuickPick(compilers, {
          title: 'Select a compiler',
        });
        if (!chosenCompiler) return;

        await project.run({
          compiler: chosenCompiler as any,
          config: chosenConfig,
        });
      },
    ),
    registerCommand(
      'stitch.clean',
      (uriOrFolder: string[] | GameMakerFolder) => {
        const project = findProject(workspace, uriOrFolder);
        if (!project) {
          void showErrorMessage('No project found to run!');
          return;
        }
        project.run({ clean: true });
      },
    ),
    registerCommand(
      'stitch.openIde',
      async (uriOrFolder: string[] | GameMakerFolder) => {
        const project = findProject(workspace, uriOrFolder);
        if (!project) {
          void showErrorMessage('No project found to open!');
          return;
        }
        await project.openInIde();
      },
    ),
    registerCommand('stitch.newProject', async () => {
      await workspace.createNewProject();
    }),
    workspace.semanticHighlightProvider.register(),
    workspace.signatureHelpStatus,
    vscode.window.onDidChangeTextEditorSelection((e) => {
      // Update the 'when' clause for the 'stitch.selectionIs(Native|Sprite|Sound)' contexts
      const ref = workspace.getRefFromSelection(
        e.textEditor.document,
        e.selections,
      );
      if (!ref) return;
      const asset = getAssetFromRef(ref);

      // Skip 'event_inherited' since we want to be able to
      // go-to-def on it to trace the inheritance chain.
      const isNative =
        !!ref.item?.native && ref.item.name !== 'event_inherited';

      void vscode.commands.executeCommand(
        'setContext',
        'stitch.selectionIsNative',
        isNative,
      );
      void vscode.commands.executeCommand(
        'setContext',
        'stitch.selectionIsSprite',
        asset?.isSprite && asset.name,
      );
      void vscode.commands.executeCommand(
        'setContext',
        'stitch.selectionIsSound',
        asset?.isSound && asset.name,
      );
    }),
    vscode.window.onDidChangeTextEditorSelection((e) => {
      // Update the function signature

      // This includes events from the output window, so skip those
      if (e.textEditor.document.uri.scheme !== 'file') {
        return;
      }
      workspace.signatureHelpStatus.text = '';
      workspace.signatureHelpStatus.hide();
      if (!stitchConfig.enableFunctionSignatureStatus) {
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
          workspace.provideSignatureHelp(
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
      workspace.signatureHelpStatus.text = asString;
      workspace.signatureHelpStatus.show();
    }),
    workspace.diagnosticCollection,
  );

  t.seconds('Extension activated in');
  return workspace;
}
