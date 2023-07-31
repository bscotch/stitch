import {
  type Asset,
  type Code,
  type DiagnosticsEventPayload,
  type FunctionArgRange,
  type OnDiagnostics,
  type Reference,
  type ReferenceableType,
  type Type,
} from '@bscotch/gml-parser';
import vscode, { CancellationToken, CompletionContext } from 'vscode';
import {
  diagnosticCollection,
  normalizeDiagnosticsEvents,
} from './diagnostics.mjs';
import { activateStitchExtension } from './extension.activate.mjs';
import {
  completionTriggerCharacters,
  inScopeSymbolsToCompletions,
  jsdocCompletions,
} from './extension.completions.mjs';
import { config } from './extension.config.mjs';
import { ChangeTracker } from './extension.onChange.mjs';
import { GameMakerProject } from './extension.project.mjs';
import { GameMakerSemanticTokenProvider } from './extension.semanticTokens.mjs';
import { locationOf, pathyFromUri, uriFromCodeFile } from './lib.mjs';
import { info, logger, warn } from './log.mjs';

export class StitchProvider
  implements
    vscode.CompletionItemProvider,
    vscode.SignatureHelpProvider,
    vscode.ReferenceProvider
{
  readonly semanticHighlightProvider = new GameMakerSemanticTokenProvider(this);
  readonly signatureHelpStatus = vscode.window.createStatusBarItem(
    config.functionSignatureStatusAlignment,
    config.functionSignatureStatusAlignment === vscode.StatusBarAlignment.Left
      ? -Infinity
      : Infinity,
  );
  readonly diagnosticCollection = diagnosticCollection;
  readonly externalChangeTracker = new ChangeTracker(this);

  projects: GameMakerProject[] = [];
  static config = config;

  readonly processingFiles = new Map<string, Promise<any>>();
  readonly debouncingOnChange = new Map<string, NodeJS.Timeout>();

  protected constructor() {
    this.signatureHelpStatus.hide();
  }

  /**
   * Emit a collection of diagnostics for a particular file. */
  emitDiagnostics(payload: DiagnosticsEventPayload) {
    this.diagnosticCollection.set(
      uriFromCodeFile(payload.code),
      normalizeDiagnosticsEvents(payload),
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

  async loadProject(yypPath: vscode.Uri, onDiagnostics: OnDiagnostics) {
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
    const symbol = this.getSignifier(document, position);
    if (!symbol) {
      return;
    }
    return [...symbol.refs.values()]
      .map((ref) => {
        return locationOf(ref);
      })
      .filter((loc) => !!loc) as vscode.Location[];
  }

  async provideCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
    token: CancellationToken,
    context: CompletionContext,
  ): Promise<vscode.CompletionItem[] | undefined> {
    // If we're already processing this file, wait for it to finish so that we get up-to-date completions.
    await this.processingFiles.get(document.uri.fsPath);
    const gmlFile = this.getGmlFile(document);
    const offset = document.offsetAt(position);
    if (!gmlFile) {
      return undefined;
    }
    // Are we inside a JSDoc comment?
    const jsdoc = gmlFile.getJsdocAt(offset);
    if (jsdoc && context.triggerCharacter === '.') {
      // Then abort!
      return;
    } else if (jsdoc) {
      return jsdocCompletions(document, position, gmlFile, jsdoc);
    } else if (context.triggerCharacter === '.' || !context.triggerCharacter) {
      const items = gmlFile.getInScopeSymbolsAt(offset);
      return inScopeSymbolsToCompletions(document, items);
    }
    return undefined;
  }

  provideSignatureHelp(
    document: vscode.TextDocument,
    position: vscode.Position,
  ): vscode.SignatureHelp | undefined {
    const argRange = this.getFunctionArg(document, position);
    if (!argRange?.param?.parent) {
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
  async updateFile(document: vscode.TextDocument): Promise<Code | undefined> {
    const code = this.getGmlFile(document);
    await code?.reload(document.getText(), {
      reloadDirty: true,
    });
    return code;
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

  getReference(
    where: vscode.TextDocument | vscode.Uri,
    position: vscode.Position,
  ): Reference | undefined {
    const document =
      where instanceof vscode.Uri
        ? vscode.workspace.textDocuments.find(
            (d) => d.uri.fsPath === where.fsPath,
          )
        : where;
    if (!document) {
      return;
    }
    const offset = document.offsetAt(position);
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

  getSignifier(
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
    if (asset && asset.assetKind === 'sprites') {
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

  /**
   * A general function for reprocessing files upon change. Handles
   * debounding and the like.
   */
  async onChangeDoc(
    event: vscode.TextDocumentChangeEvent | vscode.TextDocument | undefined,
  ) {
    if (!event) {
      return;
    }
    const doc = 'document' in event ? event.document : event;
    if (doc.languageId !== 'gml') {
      return;
    }

    // While actively typing, we don't want to reprocess on
    // every keystroke since that'll make things feel sluggish.
    // So for calls to this function triggered by typing, we
    // only immediately reprocess if the character is a trigger
    // character. Otherwise, we debounce.
    if (
      'contentChanges' in event &&
      event.contentChanges.length === 1 &&
      event.contentChanges[0].text.length
    ) {
      const isTriggerCharacter = [
        ...completionTriggerCharacters,
        ' ',
        '\r\n',
        '\n',
        ';',
        ',',
      ].includes(event.contentChanges[0].text as any);
      if (!isTriggerCharacter) {
        // TODO: Debounce this so that we still get reprocessing
        // while editing, but only when not actively typing.
        clearTimeout(this.debouncingOnChange.get(doc.uri.fsPath));
        this.debouncingOnChange.set(
          doc.uri.fsPath,
          setTimeout(() => {
            this.onChangeDoc(doc);
          }, config.reprocessOnTypeDelay),
        );
        return;
      }
    }

    if (this.processingFiles.has(doc.uri.fsPath)) {
      logger.info('Already processing file', doc.uri.fsPath);
      return;
    }

    this.diagnosticCollection.delete(doc.uri);
    // Add the processing promise to a map so
    // that other functionality can wait for it
    // to complete.
    const updateWait = StitchProvider.provider.updateFile(doc).finally(() => {
      // Semantic highlighting is normally updated by VSCode
      // upon change. But since we're delaying processing of the
      // file, we need to manually trigger a refresh.
      this.semanticHighlightProvider.refresh();
    });
    this.processingFiles.set(doc.uri.fsPath, updateWait);
    await updateWait;
    this.processingFiles.delete(doc.uri.fsPath);
  }

  /**
   * Only allow a single instance at a time.
   */
  protected static provider: StitchProvider;
  protected static ctx: vscode.ExtensionContext;

  static async activate(ctx: vscode.ExtensionContext) {
    info('Activating extension...');
    if (this.provider) {
      info('Extension already active!');
      return this.provider;
    }
    this.provider = new StitchProvider();
    await activateStitchExtension(this.provider, ctx);
    return this.provider;
  }
}
