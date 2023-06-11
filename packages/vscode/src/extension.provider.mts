import {
  type Asset,
  type Code,
  type Diagnostic,
  type FunctionArgRange,
  type ReferenceableType,
  type Type,
} from '@bscotch/gml-parser';
import vscode from 'vscode';
import { swallowThrown } from './assert.mjs';
import { debounce } from './debounce.mjs';
import { inScopeSymbolsToCompletions } from './extension.completions.mjs';
import { config } from './extension.config.mjs';
import { StitchYyFormatProvider } from './extension.formatting.mjs';
import { GameMakerHoverProvider } from './extension.hover.mjs';
import { GameMakerProject } from './extension.project.mjs';
import { GameMakerSemanticTokenProvider } from './extension.semanticTokens.mjs';
import { GameMakerWorkspaceSymbolProvider } from './extension.symbols.mjs';
import { GameMakerFolder, GameMakerTreeProvider } from './extension.tree.mjs';
import {
  locationOf,
  pathyFromUri,
  rangeFrom,
  uriFromCodeFile,
} from './lib.mjs';

const jsdocCompletions = [
  '@param',
  '@returns',
  '@description',
  '@self',
  '@function',
  '@ignore',
  '@pure',
  '@deprecated',
].map(
  (tag) => new vscode.CompletionItem(tag, vscode.CompletionItemKind.Property),
);

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

  protected projects: GameMakerProject[] = [];
  static config = config;

  protected constructor() {
    this.signatureHelpStatus.hide();
  }

  /**
   * Emit a collection of diagnostics for a particular file. */
  emitDiagnostics(diagnostics: Diagnostic[]) {
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
    const project = await GameMakerProject.from(yypPath, onDiagnostics);
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
      const item = this.getSymbol(document, position);
      if (item && !item.native && item.def) {
        return locationOf(item.def);
      } else {
        console.log('No definition found for', item);
      }
      return;
    });
  }

  provideCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
  ): vscode.CompletionItem[] | vscode.CompletionList {
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
    signature.parameters = (func.params || []).map((p) => {
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
    const offset = document.offsetAt(position);
    return this.getGmlFile(document)?.getFunctionArgRangeAt(offset);
  }

  getSymbol(
    document: vscode.TextDocument,
    position: vscode.Position,
  ): ReferenceableType | undefined {
    const offset = document.offsetAt(position);
    const file = this.getGmlFile(document);
    if (!file) {
      console.error(`Could not find file for ${document}`);
      return;
    }
    const ref = file.getReferenceAt(offset);
    if (!ref) {
      console.error(`Could not find reference at ${offset}`);
      return;
    }
    const item = ref.item;
    if (!item) {
      console.error(`Could not find symbol for ${ref}`);
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

  getAsset(document: vscode.TextDocument, name: string): Asset | undefined {
    const project = this.getProject(document);
    if (!project) {
      console.error(`Could not find project for ${document}`);
      return;
    }
    const asset = project.getAssetByName(name);
    return asset;
  }

  getGmlFile(document: vscode.TextDocument | vscode.Uri): Code | undefined {
    const project = this.getProject(document);
    if (!project) {
      console.error(`Could not find project for ${document}`);
      return;
    }
    const file = project.getGmlFile(pathyFromUri(document));
    if (!file) {
      console.error(`Could not find file for ${document}`);
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
    this.ctx ||= ctx;
    if (!this.provider) {
      this.provider = new StitchProvider();
      const onChangeDoc = debounce((event: vscode.TextDocumentChangeEvent) => {
        const doc = event.document;
        if (doc.languageId !== 'gml') {
          return;
        }
        this.provider.diagnosticCollection.delete(doc.uri);
        void StitchProvider.provider.updateFile(event.document);
      }, 50);

      vscode.workspace.onDidChangeTextDocument(onChangeDoc);
    }

    // Dispose any existing subscriptions
    // to allow for reloading the extension
    this.ctx.subscriptions.forEach((s) => s.dispose());

    this.provider.clearProjects();

    const yypFiles = await vscode.workspace.findFiles(`**/*.yyp`);

    for (const yypFile of yypFiles) {
      await StitchProvider.provider.loadProject(
        yypFile,
        this.provider.emitDiagnostics.bind(this.provider),
      );
    }

    ctx.subscriptions.push(
      new GameMakerTreeProvider(this.provider.projects).register(),
      GameMakerHoverProvider.register(this.provider),
      vscode.languages.registerCompletionItemProvider(
        'gml',
        this.provider,
        // '.',
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

    return this.provider;
  }
}
