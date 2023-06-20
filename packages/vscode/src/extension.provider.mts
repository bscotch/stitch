import {
  type Asset,
  type Code,
  type Diagnostic,
  type FunctionArgRange,
  type Reference,
  type ReferenceableType,
  type Type,
} from '@bscotch/gml-parser';
import { GameMakerFolder } from 'tree.folder.mjs';
import vscode from 'vscode';
import { assert, swallowThrown } from './assert.mjs';
import { inScopeSymbolsToCompletions } from './extension.completions.mjs';
import { config } from './extension.config.mjs';
import { StitchYyFormatProvider } from './extension.formatting.mjs';
import { GameMakerHoverProvider } from './extension.hover.mjs';
import { GameMakerProject } from './extension.project.mjs';
import { GameMakerSemanticTokenProvider } from './extension.semanticTokens.mjs';
import { GameMakerWorkspaceSymbolProvider } from './extension.symbols.mjs';
import {
  locationOf,
  pathyFromUri,
  rangeFrom,
  uriFromCodeFile,
} from './lib.mjs';
import { Timer, info, warn } from './log.mjs';
import { GameMakerTreeProvider } from './tree.mjs';

export class StitchProvider
  implements
    vscode.CompletionItemProvider,
    vscode.SignatureHelpProvider,
    vscode.DefinitionProvider,
    vscode.ReferenceProvider
{
  readonly signatureHelpStatus = vscode.window.createStatusBarItem(
    config.functionSignatureStatusAlignment,
    config.functionSignatureStatusAlignment === vscode.StatusBarAlignment.Left
      ? -Infinity
      : Infinity,
  );
  readonly diagnosticCollection =
    vscode.languages.createDiagnosticCollection('gml');

  projects: GameMakerProject[] = [];
  static config = config;

  readonly processingFiles = new Map<string, Promise<any>>();

  protected constructor() {
    this.signatureHelpStatus.hide();
  }

  /**
   * Emit a collection of diagnostics for a particular file. */
  emitDiagnostics(diagnostics: Diagnostic[]) {
    assert(diagnostics, 'diagnostics must be an array');
    if (!diagnostics.length) {
      return;
    }
    const file = diagnostics[0].location.file;
    this.diagnosticCollection.set(
      uriFromCodeFile(file),
      diagnostics.map((d) => ({
        message: d.message,
        range: rangeFrom(d.location),
        severity:
          d.severity === 'error'
            ? vscode.DiagnosticSeverity.Error
            : d.severity === 'info'
            ? vscode.DiagnosticSeverity.Information
            : vscode.DiagnosticSeverity.Warning,
        source: 'stitch',
      })),
    );
  }

  clearProjects() {
    this.projects = [];
    void vscode.commands.executeCommand(
      'setContext',
      'stitch.projectCount',
      this.projects.length,
    );
  }

  async loadProject(
    yypPath: vscode.Uri,
    onDiagnostics: (diagnostics: Diagnostic[]) => void,
  ) {
    const t = Timer.start();
    let project!: GameMakerProject;
    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: `Stitch: Loading project from ${pathyFromUri(yypPath).basename}`,
        cancellable: false,
      },
      async (progress) => {
        progress.report({
          increment: 0,
        });
        project = await GameMakerProject.from(
          yypPath,
          onDiagnostics,
          (percent, message) => {
            progress.report({
              increment: percent,
              message,
            });
          },
        );
        progress.report({
          increment: 100,
          message: 'Done!',
        });
      },
    );
    this.projects.push(project);
    void vscode.commands.executeCommand(
      'setContext',
      'stitch.projectCount',
      this.projects.length,
    );
    return project;
  }

  provideReferences(
    document: vscode.TextDocument,
    position: vscode.Position,
  ): vscode.ProviderResult<vscode.Location[]> {
    const symbol = this.getSymbol(document, position);
    if (!symbol) {
      return;
    }
    return [...symbol.refs.values()]
      .map((ref) => {
        return locationOf(ref);
      })
      .filter((loc) => !!loc) as vscode.Location[];
  }

  provideDefinition(
    document: vscode.TextDocument,
    position: vscode.Position,
  ): vscode.Location | undefined {
    return swallowThrown(() => {
      const ref = this.getReference(document, position);
      const item = ref?.item;
      if (item && !item.native && item.def) {
        return locationOf(item.def);
      } else if (ref && item?.name === 'event_inherited') {
        // Then this should take us to the parent event.
        let parent = ref.file.asset.parent;
        const eventName = ref.file.name;
        let emergencyBreak = 0;
        while (parent) {
          // Get the file for the same event.
          for (const file of parent.gmlFilesArray) {
            if (file.name === eventName) {
              return locationOf(file.startRange);
            }
          }
          emergencyBreak++;
          if (emergencyBreak > 10) {
            break;
          }
          parent = parent.parent;
        }
      }
      info('No definition found for', item);
      return;
    });
  }

  async provideCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
  ): Promise<vscode.CompletionItem[] | vscode.CompletionList> {
    info('provideCompletionItems', document, position);
    // If we're already processing this file, wait for it to finish so that we get up-to-date completions.
    await this.processingFiles.get(document.uri.fsPath);
    const gmlFile = this.getGmlFile(document);
    const offset = document.offsetAt(position);
    if (!gmlFile) {
      return [];
    }
    const items = gmlFile.getInScopeSymbolsAt(offset);
    return inScopeSymbolsToCompletions(document, items);
  }

  provideSignatureHelp(
    document: vscode.TextDocument,
    position: vscode.Position,
  ): vscode.SignatureHelp | undefined {
    info('provideSignatureHelp', document, position);
    const argRange = this.getFunctionArg(document, position);
    if (!argRange) {
      return;
    }
    const param = argRange.param;
    const func = param.parent as Type<'Function'>;
    // Create the signature help
    const signature = new vscode.SignatureInformation(
      func.code,
      func.description,
    );
    signature.activeParameter = param.idx!;
    signature.parameters = func.listParameters().map((p) => {
      return new vscode.ParameterInformation(p.name, p.description);
    });
    const help = new vscode.SignatureHelp();
    help.signatures = [signature];
    help.activeSignature = 0;
    help.activeParameter = param.idx!;
    return help;
  }

  /**
   * Determine the project the file belongs to,
   * and pass an update request to that project.
   */
  async updateFile(document: vscode.TextDocument) {
    info('updateFile', document);
    await this.getGmlFile(document)?.reload(document.getText());
  }

  getProject(
    document: vscode.TextDocument | vscode.Uri,
  ): GameMakerProject | undefined {
    if (!document) {
      return;
    }
    return this.projects.find((p) => p.includesFile(document));
  }

  getFunctionArg(
    document: vscode.TextDocument,
    position: vscode.Position,
  ): FunctionArgRange | undefined {
    info('getFunctionArg', document);
    const offset = document.offsetAt(position);
    return this.getGmlFile(document)?.getFunctionArgRangeAt(offset);
  }

  getReference(
    document: vscode.TextDocument,
    position: vscode.Position,
  ): Reference | undefined {
    const offset = document.offsetAt(position);
    info('getSymbol', document, offset);
    const file = this.getGmlFile(document);
    if (!file) {
      warn(`Could not find file for ${document}`);
      return;
    }
    const ref = file.getReferenceAt(offset);
    if (!ref) {
      warn(`Could not find reference at ${offset}`);
      return;
    }
    return ref;
  }

  getSymbol(
    document: vscode.TextDocument,
    position: vscode.Position,
  ): ReferenceableType | undefined {
    const ref = this.getReference(document, position);
    if (!ref) {
      return;
    }
    const item = ref.item;
    if (!item) {
      warn(`Could not find symbol for ${ref}`);
      return;
    }
    return item;
  }

  getSprite(
    document: vscode.TextDocument,
    name: string,
  ): Asset<'sprites'> | undefined {
    const asset = this.getAsset(document, name);
    if (asset && asset.assetType === 'sprites') {
      return asset as Asset<'sprites'>;
    }
    return;
  }

  getCurrentAsset() {
    const currentDocument = vscode.window.activeTextEditor?.document;
    if (!currentDocument) {
      return;
    }
    const currentProject = this.getProject(currentDocument);
    return currentProject?.getAsset(pathyFromUri(currentDocument));
  }

  getAsset(document: vscode.TextDocument, name: string): Asset | undefined {
    const project = this.getProject(document);
    if (!project) {
      warn(`getAsset: Could not find project for`, document);
      return;
    }
    const asset = project.getAssetByName(name);
    return asset;
  }

  getGmlFile(document: vscode.TextDocument | vscode.Uri): Code | undefined {
    const path = pathyFromUri(document);
    const project = this.getProject(document);
    if (!project) {
      warn(`getGmlFile: Could not find project for`, path);
      return;
    }
    const file = project.getGmlFile(path);
    if (!file) {
      warn(`getGmlFile: Could not find file for ${path.absolute}`);
      return;
    }
    return file;
  }

  static positionToWord(
    document: vscode.TextDocument,
    position: vscode.Position,
  ) {
    const range = document.getWordRangeAtPosition(
      position,
      /(#macro|@?[a-zA-Z0-9_]+)/,
    );
    return document.getText(range);
  }

  /**
   * Only allow a single instance at a time.
   */
  protected static provider: StitchProvider;
  protected static ctx: vscode.ExtensionContext;

  static async activate(ctx: vscode.ExtensionContext) {
    info('Activating extension...');
    const t = Timer.start();
    this.ctx ||= ctx;
    if (!this.provider) {
      this.provider = new StitchProvider();
      const onChangeDoc = (
        event: vscode.TextDocumentChangeEvent | vscode.TextDocument,
      ) => {
        const doc = 'document' in event ? event.document : event;
        if (doc.languageId !== 'gml') {
          return;
        }
        this.provider.diagnosticCollection.delete(doc.uri);
        // Add the processing promise to a map so
        // that other functionality can wait for it
        // to complete.
        this.provider.processingFiles.set(
          doc.uri.fsPath,
          StitchProvider.provider.updateFile(doc),
        );
        this.provider.processingFiles.get(doc.uri.fsPath)!.then(() => {
          this.provider.processingFiles.delete(doc.uri.fsPath);
        });
      };
      // Ensure that things stay up to date!
      vscode.workspace.onDidChangeTextDocument(onChangeDoc);
      vscode.workspace.onDidOpenTextDocument(onChangeDoc);
    }

    // Dispose any existing subscriptions
    // to allow for reloading the extension
    this.ctx.subscriptions.forEach((s) => s.dispose());

    this.provider.clearProjects();

    info('Loading projects...');
    const yypFiles = await vscode.workspace.findFiles(`**/*.yyp`);
    for (const yypFile of yypFiles) {
      info('Loading project', yypFile);
      const pt = Timer.start();
      await StitchProvider.provider.loadProject(
        yypFile,
        this.provider.emitDiagnostics.bind(this.provider),
      );
      pt.seconds('Loaded project in');
    }

    const treeProvider = new GameMakerTreeProvider(this.provider);

    ctx.subscriptions.push(
      ...treeProvider.register(),
      GameMakerHoverProvider.register(this.provider),
      vscode.languages.registerCompletionItemProvider(
        'gml',
        this.provider,
        '.',
        // '"',
      ),
      vscode.languages.registerSignatureHelpProvider(
        'gml',
        this.provider,
        '(',
        ',',
      ),
      vscode.languages.registerDocumentFormattingEditProvider(
        'yy',
        new StitchYyFormatProvider(),
      ),
      vscode.languages.registerDefinitionProvider('gml', this.provider),
      vscode.languages.registerReferenceProvider('gml', this.provider),
      vscode.languages.registerWorkspaceSymbolProvider(
        new GameMakerWorkspaceSymbolProvider(this.provider.projects),
      ),
      vscode.commands.registerCommand(
        'stitch.run',
        (uriOrFolder: string[] | GameMakerFolder) => {
          // Identify the target project
          let project: GameMakerProject | undefined;
          if (this.provider.projects.length === 1) {
            project = this.provider.projects[0];
          } else if (uriOrFolder instanceof GameMakerFolder) {
            // Then we clicked in the tree view
            project = this.provider.projects.find(
              (p) => p.name === uriOrFolder.name,
            );
          } else {
            const uriString =
              uriOrFolder[0] ||
              vscode.window.activeTextEditor?.document.uri.toString();
            if (uriString) {
              const uri = vscode.Uri.parse(uriString);
              project = this.provider.getProject(uri);
            }
          }

          if (!project) {
            void vscode.window.showErrorMessage('No project found to run!');
            return;
          }
          project.run();
        },
      ),
      vscode.commands.registerCommand('stitch.openIde', (...args) => {
        const uri = vscode.Uri.parse(
          args[0] || vscode.window.activeTextEditor?.document.uri.toString(),
        );
        this.provider.getProject(uri)?.openInIde();
      }),
      new GameMakerSemanticTokenProvider(this.provider).register(),
      this.provider.signatureHelpStatus,
      vscode.window.onDidChangeTextEditorSelection((e) => {
        // This includes events from the output window, so skip those
        if (e.textEditor.document.uri.scheme !== 'file') {
          return;
        }
        this.provider.signatureHelpStatus.text = '';
        this.provider.signatureHelpStatus.hide();
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
            this.provider.provideSignatureHelp(
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
        const signature =
          signatureHelp.signatures[signatureHelp.activeSignature];
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
        this.provider.signatureHelpStatus.text = asString;
        this.provider.signatureHelpStatus.show();
      }),
      this.provider.diagnosticCollection,
    );

    t.seconds('Extension activated in');
    return this.provider;
  }
}
