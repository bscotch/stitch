import { literal } from '@bscotch/utility';
import vscode from 'vscode';
import { stitchConfig } from './config.mjs';
import {
  createCopyAsJsdocSelfCallback,
  createCopyAsJsdocTypeCallback,
  createCopyAsTypeCallback,
} from './extension.copyType.mjs';
import { StitchYyFormatProvider } from './extension.formatting.mjs';
import { StitchLauncherProvider } from './extension.launcher.mjs';
import { StitchLensProvider } from './extension.lens.mjs';
import { StitchLocationsProvider } from './extension.locations.mjs';
import { StitchReleasePickerProvider } from './extension.releases.mjs';
import type { StitchWorkspace } from './extension.workspace.mjs';
import { StitchIncludedFilesTree } from './includedFilesTree.mjs';
import { GameMakerInspectorProvider } from './inspector.mjs';
import { createSorter, findProject, registerCommand } from './lib.mjs';
import { Timer, info, logger, showErrorMessage, warn } from './log.mjs';
import { chooseWorkspaceProject } from './projectDiscovery.mjs';
import { SpriteSourcesTree } from './spriteSources.mjs';
import { GameMakerFolder } from './tree.folder.mjs';
import { TreeAsset, TreeCode } from './tree.items.mjs';
import { GameMakerTreeProvider } from './tree.mjs';
import { StitchIgorView } from './webview.igor.mjs';
import { StitchSpriteEditorProvider } from './webviews.spriteEditor.mjs';

/** Debounce a function, keeping only the latest call's arguments */
function debounce<T extends any[]>(fn: (...args: T) => unknown, ms: number) {
  let timer: NodeJS.Timeout | undefined;
  return (...args: T) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

export async function activateStitchExtension(
  workspace: StitchWorkspace,
  ctx: vscode.ExtensionContext,
) {
  info('Activating extension...');
  stitchConfig.context = ctx;

  const t = Timer.start();

  // Dispose any existing subscriptions
  // to allow for reloading the extension
  ctx.subscriptions.forEach((s) => s.dispose());

  await workspace.clearProjects();

  // Dev-only watcher: reload window when files in dist/ or assets/ change,
  // debounced so rapid changes only trigger one reload.
  if (ctx.extensionMode === vscode.ExtensionMode.Development) {
    const scheduleReload = debounce(() => {
      console.log('Extension source updated. Reloading!');
      void vscode.commands.executeCommand('workbench.action.reloadWindow');
    }, 100);
    for (const pattern of ['dist/**', 'assets/**']) {
      const watcher = vscode.workspace.createFileSystemWatcher(
        new vscode.RelativePattern(ctx.extensionPath, pattern),
      );
      watcher.onDidCreate(scheduleReload);
      watcher.onDidChange(scheduleReload);
      watcher.onDidDelete(scheduleReload);
      ctx.subscriptions.push(watcher);
    }
  }

  info('Looking for projects...');
  const yypFile = await chooseWorkspaceProject();
  if (!yypFile) {
    warn('No GameMaker project found (or chosen) in this workspace.');
  } else {
    info('Loading project', yypFile.fsPath);
    const pt = Timer.start();
    try {
      await workspace.loadProject(yypFile);
      pt.seconds('Loaded project in');
    } catch (error) {
      logger.error(error);
      logger.error('Error loading project', yypFile.fsPath);
      void showErrorMessage(
        `Could not load project ${yypFile.fsPath}. This is likely because Stitch does not support the version of GameMaker that was last used with your project. [Submit a GitHub issue](https://github.com/bscotch/stitch/issues/new) with your \`.yyp\` file attached to see if this can be resolved in future versions of Stitch. See your Output panel for Stitch for a full error message.`,
      );
    }
  }

  const treeProvider = new GameMakerTreeProvider(workspace);
  workspace.tree = treeProvider;
  const inspectorProvider = new GameMakerInspectorProvider(workspace);

  ctx.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration('stitch')) workspace.onSettingsChanged();
    }),
    ...treeProvider.register(),
    ...inspectorProvider.register(),
    ...StitchIncludedFilesTree.register(workspace),
    ...StitchReleasePickerProvider.register(workspace),
    ...(SpriteSourcesTree?.register(workspace) || []),
    StitchLensProvider.register(workspace),
    ...StitchIgorView.register(workspace),
    ...StitchSpriteEditorProvider.register(workspace),
    ...StitchLocationsProvider.register(workspace),
    ...StitchLauncherProvider.register(workspace),
    vscode.languages.registerDocumentFormattingEditProvider(
      'yy',
      new StitchYyFormatProvider(),
    ),
    registerCommand('stitch.assets.delete', async (what: unknown) => {
      const asset =
        what instanceof TreeAsset
          ? what.asset
          : what && typeof what === 'object' && 'asset' in what
            ? (what.asset as TreeAsset['asset'])
            : undefined;
      if (!asset) {
        logger.warn('stitch.assets.delete called on unknown type', what);
        return;
      }
      try {
        await workspace.deleteAsset(asset);
      } catch (err) {
        void showErrorMessage(err as Error);
      }
    }),
    registerCommand('stitch.assets.deleteCode', async (what: unknown) => {
      if (!(what instanceof TreeCode)) {
        logger.warn('stitch.assets.deleteCode called on unknown type', what);
        return;
      }
      const project = workspace.getProjectOfAsset(what.asset);
      if (!project || !what.event) return;
      try {
        await project.gm.deleteObjectEvent(what.asset, what.event);
      } catch (err) {
        void showErrorMessage(err as Error);
      }
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
    registerCommand(
      'stitch.openDocs',
      async (options?: { from?: 'keybind' }) => {
        const project = workspace.getActiveProject();
        const editor = vscode.window.activeTextEditor;
        if (!project) return;
        let word = '';
        if (editor) {
          const range = editor.document.getWordRangeAtPosition(
            editor.selection.active,
          );
          if (range) word = editor.document.getText(range);
        }
        if (options?.from === 'keybind') {
          // Only for built-in functions and variables
          const symbol = await workspace.getSymbolAtCursor();
          if (!symbol?.native) return;
        }
        await vscode.env.openExternal(
          vscode.Uri.parse(await project.helpLink(word)),
        );
      },
    ),
    registerCommand(
      'stitch.run',
      async (uriOrFolder: string[] | GameMakerFolder) => {
        const project = findProject(workspace, uriOrFolder);
        if (!project) {
          void showErrorMessage('No project found to run!');
          return;
        }
        let lastConfig: any = ctx.workspaceState.get('lastRunConfig');
        const isValidConfig =
          typeof lastConfig === 'object' &&
          'compiler' in lastConfig &&
          'config' in lastConfig;
        if (!isValidConfig) {
          lastConfig = undefined;
        }
        try {
          await project.run(lastConfig);
        } catch (err) {
          void showErrorMessage(err as Error);
        }
      },
    ),
    registerCommand(
      'stitch.stop',
      (uriOrFolder: string[] | GameMakerFolder) => {
        const project = findProject(workspace, uriOrFolder);
        if (!project) {
          void showErrorMessage('No project found to run!');
          return;
        }
        void project.kill();
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
        const configs = [...project.configs].sort(
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

        void ctx.workspaceState.update('lastRunConfig', {
          compiler: chosenCompiler as any,
          config: chosenConfig,
        });

        const when = await vscode.window.showQuickPick(
          [
            { label: 'Run Now', now: true, picked: true },
            {
              label: 'Run Later',
              now: false,
              detail:
                'All future runs will use the new target until you change it again.',
            },
          ],
          {
            title: 'Target Updated! Run now?',
          },
        );
        if (when?.now) {
          await project.run({
            compiler: chosenCompiler as any,
            config: chosenConfig,
          });
        }
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
        void project.run({ clean: true });
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
    workspace.signatureHelpStatus,
    vscode.window.onDidChangeTextEditorSelection(
      debounce(
        (e: vscode.TextEditorSelectionChangeEvent) =>
          void updateSelectionContext(workspace, e),
        100,
      ),
    ),
    vscode.window.onDidChangeTextEditorSelection(
      debounce(
        (e: vscode.TextEditorSelectionChangeEvent) =>
          void updateSignatureStatus(workspace, e),
        100,
      ),
    ),
  );

  t.seconds('Extension activated in');
  return workspace;
}

/**
 * Update the `stitch.selectionIs(Native|Sprite|Sound)` contexts, which
 * decide which commands are shown for the symbol at the cursor.
 */
async function updateSelectionContext(
  workspace: StitchWorkspace,
  e: vscode.TextEditorSelectionChangeEvent,
) {
  const document = e.textEditor.document;
  if (document.languageId !== 'gml' || document.uri.scheme !== 'file') return;
  const symbol = await workspace.getSymbolInfo(document, e.selections[0].start);
  // `event_inherited` is excluded so that go-to-definition can be used on
  // it, to trace the inheritance chain
  const isNative = !!symbol?.native && symbol.name !== 'event_inherited';
  const assetKind = symbol?.kind === 'asset' ? symbol.assetKind : undefined;
  const setContext = (key: string, value: unknown) =>
    void vscode.commands.executeCommand('setContext', key, value);
  setContext('stitch.selectionIsNative', isNative);
  setContext(
    'stitch.selectionIsSprite',
    assetKind === 'sprites' ? symbol!.name : false,
  );
  setContext(
    'stitch.selectionIsSound',
    assetKind === 'sounds' ? symbol!.name : false,
  );
}

/** Show the signature of the function call at the cursor in the status bar */
async function updateSignatureStatus(
  workspace: StitchWorkspace,
  e: vscode.TextEditorSelectionChangeEvent,
) {
  const status = workspace.signatureHelpStatus;
  const document = e.textEditor.document;
  // (Selection events include the output window)
  if (document.uri.scheme !== 'file' || document.languageId !== 'gml') {
    return;
  }
  if (
    !stitchConfig.enableFunctionSignatureStatus ||
    e.selections.length !== 1
  ) {
    status.hide();
    return;
  }
  let help: vscode.SignatureHelp | undefined;
  try {
    help = await vscode.commands.executeCommand<vscode.SignatureHelp>(
      'vscode.executeSignatureHelpProvider',
      document.uri,
      e.selections[0].start,
    );
  } catch {
    // (No provider, or it failed)
  }
  const signature = help?.signatures[help.activeSignature];
  const name = signature?.label.match(/^function\s+([^(]+)/i)?.[1];
  if (!help || !signature || !name) {
    status.hide();
    return;
  }
  // The status bar can't be formatted, so the current parameter is upper-cased
  const params = signature.parameters.map((p, i) => {
    const label =
      typeof p.label === 'string'
        ? p.label
        : signature.label.slice(p.label[0], p.label[1]);
    const paramName = label.split(/[?:]/)[0];
    return i === help.activeParameter ? paramName.toUpperCase() : paramName;
  });
  status.text = `${name}(${params.join(', ')})`;
  status.show();
}
