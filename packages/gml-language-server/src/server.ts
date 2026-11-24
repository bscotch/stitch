/**
 * The language server: LSP handlers, document syncing, and scheduling of
 * analysis and diagnostics for one GameMaker project.
 */
import { TextDocument } from 'vscode-languageserver-textdocument';
import {
  DidChangeConfigurationNotification,
  ErrorCodes,
  ResponseError,
  TextDocuments,
  TextDocumentSyncKind,
  type CancellationToken,
  type Connection,
  type InitializeParams,
  type InitializeResult,
  type TextDocumentPositionParams,
} from 'vscode-languageserver/node';
import {
  assetRenameEdits,
  completions,
  definition,
  diagnostics,
  formatDocument,
  hover,
  prepareRename,
  references,
  rename,
  RenameError,
  semanticTokens,
  signatureHelp,
  symbolInfo,
  typeDefinition,
  workspaceSymbols,
} from './features.ts';
import {
  assetRenameEditsRequest,
  semanticTokenModifiers,
  semanticTokenTypes,
  statusNotification,
  symbolInfoRequest,
  type AssetRenameEditsParams,
  type GmlServerInitializationOptions,
  type GmlServerSettings,
  type StatusParams,
  type SymbolInfoParams,
} from './protocol.ts';
import { ProjectSession } from './session.ts';
import { pathToUri, uriToPath } from './uri.ts';

/** How long to wait after the last change before re-checking every file's diagnostics */
const FULL_DIAGNOSTICS_DELAY = 750;

export class GmlLanguageServer {
  readonly connection: Connection;
  readonly documents = new TextDocuments(TextDocument);
  protected options: GmlServerInitializationOptions | undefined;
  protected settings: GmlServerSettings = {};
  protected session: ProjectSession | undefined;
  /** Resolves once the project has loaded (to undefined if it couldn't be) */
  protected loading: Promise<ProjectSession | undefined> | undefined;
  protected updateTimer: NodeJS.Timeout | undefined;
  protected fullDiagnosticsTimer: NodeJS.Timeout | undefined;
  /** The diagnostics last published for each file (as JSON), by file id */
  protected readonly published = new Map<string, string>();
  protected canRefreshSemanticTokens = false;
  protected disposed = false;

  constructor(connection: Connection) {
    this.connection = connection;
    this.documents.listen(connection);
    this.registerHandlers();
  }

  //#region Lifecycle

  protected initialize(params: InitializeParams): InitializeResult {
    const options = params.initializationOptions as
      GmlServerInitializationOptions | undefined;
    if (!options?.yypPath) {
      throw new ResponseError(
        ErrorCodes.InvalidParams,
        'The `yypPath` initialization option is required.',
      );
    }
    this.options = options;
    this.settings = options.settings ?? {};
    this.canRefreshSemanticTokens =
      !!params.capabilities.workspace?.semanticTokens?.refreshSupport;
    return {
      capabilities: {
        textDocumentSync: TextDocumentSyncKind.Incremental,
        hoverProvider: true,
        completionProvider: {
          triggerCharacters: ['.', '{', '<', '|', '@'],
        },
        signatureHelpProvider: {
          triggerCharacters: ['(', ','],
          retriggerCharacters: [','],
        },
        definitionProvider: true,
        typeDefinitionProvider: true,
        referencesProvider: true,
        renameProvider: { prepareProvider: true },
        semanticTokensProvider: {
          legend: {
            tokenTypes: [...semanticTokenTypes],
            tokenModifiers: [...semanticTokenModifiers],
          },
          full: true,
        },
        workspaceSymbolProvider: true,
        documentFormattingProvider: true,
      },
      serverInfo: { name: 'gml-language-server' },
    };
  }

  /** Load the project. Requests made while loading wait for it. */
  protected load(): Promise<ProjectSession | undefined> {
    const options = this.options!;
    this.status({ state: 'loading', message: 'Loading project...' });
    const started = Date.now();
    this.loading = ProjectSession.open(options.yypPath, {
      specs: options.specs,
      autoDeclareGlobalsPrefixes:
        this.settings.diagnostics?.autoDeclaredGlobalsPrefixes,
      openText: (file) => this.openText(file),
      onError: (err) => this.connection.console.warn(String(err.message)),
      onDirty: () => this.scheduleUpdate(),
    }).then(
      (session) => {
        if (this.disposed) {
          session.dispose();
          return undefined;
        }
        this.session?.dispose();
        this.session = session;
        this.status({
          state: 'ready',
          files: session.fileIds.length,
          ms: Date.now() - started,
        });
        this.publishAllDiagnostics();
        this.refreshSemanticTokens();
        return session;
      },
      (err: Error) => {
        this.connection.console.error(
          `Could not load the project: ${err.stack ?? err.message}`,
        );
        this.status({ state: 'error', message: err.message });
        return undefined;
      },
    );
    return this.loading;
  }

  dispose() {
    this.disposed = true;
    clearTimeout(this.updateTimer);
    clearTimeout(this.fullDiagnosticsTimer);
    this.session?.dispose();
  }

  protected status(params: StatusParams) {
    void this.connection.sendNotification(statusNotification, params);
  }

  //#endregion

  //#region Documents and updates

  protected openText(file: string): string | undefined {
    return this.documents.get(pathToUri(file))?.getText();
  }

  protected get openFileIds(): string[] {
    const session = this.session;
    if (!session) return [];
    return this.documents
      .keys()
      .map((uri) => uriToPath(uri))
      .map((file) => (file ? session.fileIdOf(file) : undefined))
      .filter((id): id is string => !!id);
  }

  protected scheduleUpdate() {
    clearTimeout(this.updateTimer);
    this.updateTimer = setTimeout(
      () => void this.update(),
      this.settings.analysisDelay ?? 50,
    );
  }

  /** Bring the analysis up to date and publish what changed */
  protected async update(): Promise<void> {
    clearTimeout(this.updateTimer);
    const session = this.session;
    if (!session) return;
    let result;
    try {
      result = await session.update();
    } catch (err) {
      this.connection.console.error(
        `Analysis failed: ${(err as Error).stack ?? err}`,
      );
      return;
    }
    for (const id of result.removed) {
      this.published.delete(id);
      void this.connection.sendDiagnostics({
        uri: pathToUri(session.pathOf(id)),
        diagnostics: [],
      });
    }
    if (!result.checked.size && !result.touched.size) return;
    // Changed and open files right away, the rest once things settle
    this.publishDiagnostics(
      new Set([...result.checked, ...result.touched, ...this.openFileIds]),
    );
    this.scheduleFullDiagnostics();
    this.refreshSemanticTokens();
  }

  /** Wait for loading, and for any pending changes to be analyzed */
  protected async ready(): Promise<ProjectSession | undefined> {
    const session = await this.loading;
    if (session?.hasPendingChanges) await this.update();
    return session;
  }

  protected refreshSemanticTokens() {
    if (!this.canRefreshSemanticTokens) return;
    void this.connection.languages.semanticTokens.refresh().catch(() => {});
  }

  //#endregion

  //#region Diagnostics

  protected publishDiagnostics(fileIds: Iterable<string>, force = false) {
    const session = this.session;
    if (!session) return;
    for (const id of fileIds) {
      if (!session.sourceFile(id)) continue;
      const result = diagnostics(session, id, this.settings);
      const json = JSON.stringify(result);
      if (!force && this.published.get(id) === json) continue;
      if (!result.length && !this.published.has(id) && !force) continue;
      this.published.set(id, json);
      void this.connection.sendDiagnostics({
        uri: pathToUri(session.pathOf(id)),
        diagnostics: result,
      });
    }
  }

  protected publishAllDiagnostics(force = false) {
    clearTimeout(this.fullDiagnosticsTimer);
    if (this.session) this.publishDiagnostics(this.session.fileIds, force);
  }

  protected scheduleFullDiagnostics() {
    clearTimeout(this.fullDiagnosticsTimer);
    this.fullDiagnosticsTimer = setTimeout(
      () => this.publishAllDiagnostics(),
      FULL_DIAGNOSTICS_DELAY,
    );
  }

  //#endregion

  //#region Settings

  protected async changeSettings(settings: GmlServerSettings) {
    const before = JSON.stringify(
      this.settings.diagnostics?.autoDeclaredGlobalsPrefixes ?? [],
    );
    this.settings = settings ?? {};
    const after = JSON.stringify(
      this.settings.diagnostics?.autoDeclaredGlobalsPrefixes ?? [],
    );
    if (before !== after && this.options) {
      // Changes how files are checked, so start over
      await this.loading;
      await this.load();
      return;
    }
    this.publishAllDiagnostics(true);
  }

  //#endregion

  //#region Handlers

  /**
   * Run a handler for a position in a project GML file, once the file's
   * analysis is up to date. Returns `fallback` for other files.
   */
  protected async atPosition<T, F>(
    params: TextDocumentPositionParams,
    fallback: F,
    fn: (session: ProjectSession, fileId: string, offset: number) => T,
    token?: CancellationToken,
  ): Promise<T | F> {
    const session = await this.ready();
    if (!session || token?.isCancellationRequested) return fallback;
    const file = uriToPath(params.textDocument.uri);
    const fileId = file ? session.fileIdOf(file) : undefined;
    if (!fileId) return fallback;
    if (session.isStale(fileId)) {
      session.markDirty(file!);
      await this.update();
    }
    const lines = session.analyzer.getFile(fileId)?.lines;
    if (!lines) return fallback;
    return fn(session, fileId, lines.offsetAt(params.position));
  }

  protected registerHandlers() {
    const { connection, documents } = this;

    connection.onInitialize((params) => this.initialize(params));
    connection.onInitialized(() => {
      void connection.client
        .register(DidChangeConfigurationNotification.type, undefined)
        .catch(() => {});
      void this.load();
    });
    connection.onShutdown(() => this.dispose());
    connection.onDidChangeConfiguration(
      (params) =>
        void this.changeSettings(params.settings as GmlServerSettings),
    );

    // Keep up with the editor's documents and the file system
    documents.onDidChangeContent((e) => {
      const file = uriToPath(e.document.uri);
      if (file) this.session?.markDirty(file);
    });
    documents.onDidClose((e) => {
      const file = uriToPath(e.document.uri);
      // Back to what's on disk
      if (file) this.session?.markDirty(file);
    });
    connection.onDidChangeWatchedFiles((params) => {
      const files = params.changes
        .map((c) => uriToPath(c.uri))
        .filter((f): f is string => !!f);
      this.session?.project.notifyChanged(files);
    });

    connection.onHover((params, token) =>
      this.atPosition(params, null, hover, token),
    );
    connection.onDefinition((params, token) =>
      this.atPosition(params, [], definition, token),
    );
    connection.onTypeDefinition((params, token) =>
      this.atPosition(params, [], typeDefinition, token),
    );
    connection.onReferences((params, token) =>
      this.atPosition(
        params,
        [],
        (session, fileId, offset) =>
          references(
            session,
            fileId,
            offset,
            params.context.includeDeclaration,
          ),
        token,
      ),
    );
    connection.onSignatureHelp((params, token) =>
      this.atPosition(params, null, signatureHelp, token),
    );
    connection.onCompletion((params, token) =>
      this.atPosition(
        params,
        null,
        (session, fileId, offset) =>
          completions(
            session,
            fileId,
            offset,
            params.context?.triggerCharacter,
            this.settings,
          ),
        token,
      ),
    );
    connection.onPrepareRename((params) =>
      this.atPosition(params, null, (session, fileId, offset) =>
        this.asRenameResult(() => prepareRename(session, fileId, offset)),
      ),
    );
    connection.onRenameRequest((params) =>
      this.atPosition(params, null, (session, fileId, offset) =>
        this.asRenameResult(() =>
          rename(session, fileId, offset, params.newName),
        ),
      ),
    );
    connection.languages.semanticTokens.on(async (params) => {
      const session = await this.ready();
      const file = uriToPath(params.textDocument.uri);
      const fileId = file && session?.fileIdOf(file);
      if (!session || !fileId) return { data: [] };
      if (session.isStale(fileId)) {
        session.markDirty(file);
        await this.update();
      }
      return semanticTokens(session, fileId);
    });
    connection.onWorkspaceSymbol(async (params) => {
      const session = await this.ready();
      if (!session) return [];
      return workspaceSymbols(
        session,
        params.query,
        this.settings,
        this.openFileIds,
      );
    });
    connection.onDocumentFormatting((params) => {
      const document = documents.get(params.textDocument.uri);
      if (!document) return null;
      const { edits, error } = formatDocument(
        document.getText(),
        this.settings,
      );
      if (error) {
        connection.console.warn(`Not formatting: ${error}`);
      }
      return edits;
    });

    // Stitch's own requests
    connection.onRequest(symbolInfoRequest, (params: SymbolInfoParams) =>
      this.atPosition(params, null, symbolInfo),
    );
    connection.onRequest(
      assetRenameEditsRequest,
      async (params: AssetRenameEditsParams) => {
        const session = await this.ready();
        if (!session) return { changes: {} };
        return assetRenameEdits(session, params.name, params.newName);
      },
    );
  }

  protected asRenameResult<T>(fn: () => T): T {
    try {
      return fn();
    } catch (err) {
      if (err instanceof RenameError) {
        throw new ResponseError(ErrorCodes.InvalidRequest, err.message);
      }
      throw err;
    }
  }

  //#endregion
}

/** Start a language server on a connection */
export function startServer(connection: Connection): GmlLanguageServer {
  const server = new GmlLanguageServer(connection);
  connection.listen();
  return server;
}
