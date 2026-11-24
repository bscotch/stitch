import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { PassThrough } from 'node:stream';
import { after, before, describe, it } from 'node:test';
import {
  createConnection,
  createProtocolConnection,
  StreamMessageReader,
  StreamMessageWriter,
  type CompletionItem,
  type Hover,
  type Location,
  type ProtocolConnection,
  type PublishDiagnosticsParams,
  type SignatureHelp,
  type SymbolInformation,
  type TextEdit,
  type WorkspaceEdit,
} from 'vscode-languageserver/node';
import {
  assetRenameEditsRequest,
  globalNamesRequest,
  statusNotification,
  symbolInfoRequest,
  type GmlServerInitializationOptions,
  type StatusParams,
  type SymbolInfo,
} from './protocol.ts';
import { startServer, type GmlLanguageServer } from './server.ts';
import { pathToUri } from './uri.ts';

const sampleProject = path.resolve(
  import.meta.dirname,
  '../../parser/samples/project',
);

interface TestClient {
  connection: ProtocolConnection;
  server: GmlLanguageServer;
  dir: string;
  uri(file: string): string;
  /** The latest diagnostics for a file */
  diagnostics: Map<string, PublishDiagnosticsParams>;
  statuses: StatusParams[];
  /** Resolves when the server reports a status in this state */
  waitForStatus(state: StatusParams['state']): Promise<StatusParams>;
  /** Wait for a diagnostics notification for a file that passes a check */
  waitForDiagnostics(
    file: string,
    check: (params: PublishDiagnosticsParams) => boolean,
  ): Promise<PublishDiagnosticsParams>;
  open(file: string, text?: string): Promise<string>;
  /** The position of the `n`th occurrence of `needle` in a text (plus an offset into it) */
  positionIn(
    text: string,
    needle: string,
    n?: number,
    delta?: number,
  ): { line: number; character: number };
}

async function startClient(): Promise<TestClient> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'gml-ls-'));
  await fs.cp(sampleProject, dir, { recursive: true });

  const toServer = new PassThrough();
  const toClient = new PassThrough();
  const server = startServer(createConnection(toServer, toClient));
  const connection = createProtocolConnection(
    new StreamMessageReader(toClient),
    new StreamMessageWriter(toServer),
  );
  const diagnostics = new Map<string, PublishDiagnosticsParams>();
  const statuses: StatusParams[] = [];
  const statusWaiters: [string, (s: StatusParams) => void][] = [];
  const diagnosticWaiters: {
    uri: string;
    check: (p: PublishDiagnosticsParams) => boolean;
    resolve: (p: PublishDiagnosticsParams) => void;
  }[] = [];
  connection.onNotification(statusNotification, (params: StatusParams) => {
    statuses.push(params);
    for (const [state, resolve] of statusWaiters.splice(0)) {
      if (state === params.state) resolve(params);
      else statusWaiters.push([state, resolve]);
    }
  });
  connection.onNotification(
    'textDocument/publishDiagnostics',
    (params: PublishDiagnosticsParams) => {
      diagnostics.set(params.uri, params);
      for (const waiter of diagnosticWaiters.splice(0)) {
        if (waiter.uri === params.uri && waiter.check(params)) {
          waiter.resolve(params);
        } else diagnosticWaiters.push(waiter);
      }
    },
  );
  connection.onRequest('client/registerCapability', () => null);
  connection.onRequest('workspace/semanticTokens/refresh', () => null);
  connection.listen();

  const uri = (file: string) => pathToUri(path.join(dir, file));
  const client: TestClient = {
    connection,
    server,
    dir,
    uri,
    diagnostics,
    statuses,
    waitForStatus(state) {
      const done = statuses.find((s) => s.state === state);
      if (done) return Promise.resolve(done);
      return new Promise((resolve) => statusWaiters.push([state, resolve]));
    },
    waitForDiagnostics(file, check) {
      const current = diagnostics.get(uri(file));
      if (current && check(current)) return Promise.resolve(current);
      return new Promise((resolve) =>
        diagnosticWaiters.push({ uri: uri(file), check, resolve }),
      );
    },
    async open(file, text) {
      text ??= await fs.readFile(path.join(dir, file), 'utf8');
      await connection.sendNotification('textDocument/didOpen', {
        textDocument: { uri: uri(file), languageId: 'gml', version: 1, text },
      });
      return text;
    },
    positionIn(text, needle, n = 0, delta = 0) {
      let offset = -1;
      for (let i = 0; i <= n; i++) {
        offset = text.indexOf(needle, offset + 1);
        assert.ok(offset >= 0, `"${needle}" #${n} not found`);
      }
      offset += delta;
      const before = text.slice(0, offset).split(/\r?\n/);
      return { line: before.length - 1, character: before.at(-1)!.length };
    },
  };

  const initializationOptions: GmlServerInitializationOptions = {
    yypPath: path.join(dir, 'project.yyp'),
    settings: { diagnostics: { suppressGroups: [] } },
  };
  await connection.sendRequest('initialize', {
    processId: null,
    rootUri: pathToUri(dir),
    capabilities: { workspace: { semanticTokens: { refreshSupport: true } } },
    initializationOptions,
  });
  await connection.sendNotification('initialized', {});
  return client;
}

describe('GmlLanguageServer', function () {
  let client: TestClient;
  const script1 = 'scripts/Script1/Script1.gml';
  let script1Text: string;

  before(async function () {
    client = await startClient();
    const status = await client.waitForStatus('ready');
    assert.ok(status.files! > 10, 'Loads the project files');
    script1Text = await client.open(script1);
  });

  after(async function () {
    client.connection.dispose();
    client.server.dispose();
    await fs.rm(client.dir, { recursive: true, force: true });
  });

  const at = (needle: string, n = 0, delta = 1) => ({
    textDocument: { uri: client.uri(script1) },
    position: client.positionIn(script1Text, needle, n, delta),
  });

  it('publishes diagnostics for project files', function () {
    assert.ok(client.diagnostics.size > 0);
    for (const params of client.diagnostics.values()) {
      for (const d of params.diagnostics) {
        assert.equal(d.source, 'stitch');
        assert.ok(d.code);
      }
    }
  });

  it('provides hovers', async function () {
    const result: Hover | null = await client.connection.sendRequest(
      'textDocument/hover',
      at('global_function', 1),
    );
    assert.ok(result);
    const value = (result.contents as { value: string }).value;
    assert.match(value, /function global_function\(/);
    assert.match(value, /A global function!/);
  });

  it('goes to definitions, including assets', async function () {
    const defs: Location[] = await client.connection.sendRequest(
      'textDocument/definition',
      at('global_function', 1),
    );
    assert.equal(defs.length, 1);
    assert.equal(defs[0].uri, client.uri(script1));
    assert.deepEqual(
      defs[0].range.start,
      client.positionIn(script1Text, 'global_function'),
    );

    const objectDefs: Location[] = await client.connection.sendRequest(
      'textDocument/definition',
      at('o_parent'),
    );
    assert.equal(objectDefs.length, 1);
    assert.match(objectDefs[0].uri, /objects\/o_parent\//);
  });

  it('goes from event_inherited() to the parent event', async function () {
    const file = 'objects/o_child1/Create_0.gml';
    const text = await client.open(file);
    const defs: Location[] = await client.connection.sendRequest(
      'textDocument/definition',
      {
        textDocument: { uri: client.uri(file) },
        position: client.positionIn(text, 'event_inherited', 0, 1),
      },
    );
    assert.equal(defs.length, 1);
    assert.match(defs[0].uri, /objects\/o_parent\/Create_0\.gml$/);
  });

  it('finds references and renames symbols', async function () {
    const refs: Location[] = await client.connection.sendRequest(
      'textDocument/references',
      { ...at('global_function'), context: { includeDeclaration: true } },
    );
    assert.ok(refs.length >= 2);

    const range = await client.connection.sendRequest(
      'textDocument/prepareRename',
      at('global_function'),
    );
    assert.ok(range);
    const edit: WorkspaceEdit = await client.connection.sendRequest(
      'textDocument/rename',
      { ...at('global_function'), newName: 'renamed_function' },
    );
    const edits = Object.values(edit.changes!).flat();
    assert.equal(edits.length, refs.length);
    assert.ok(edits.every((e) => e.newText === 'renamed_function'));

    // Built-ins and assets can't be renamed, and say why
    const file = 'scripts/Withing/Withing.gml';
    const text = 'show_debug_message(o_parent);';
    await client.open(file, text);
    for (const [needle, reason] of [
      ['show_debug_message', /Built-in/],
      ['o_parent', /asset tree/],
    ] as const) {
      await assert.rejects(
        () =>
          client.connection.sendRequest('textDocument/prepareRename', {
            textDocument: { uri: client.uri(file) },
            position: client.positionIn(text, needle, 0, 1),
          }),
        reason,
      );
    }
    await client.connection.sendNotification('textDocument/didClose', {
      textDocument: { uri: client.uri(file) },
    });
  });

  it('completes symbols, doc tags and doc types', async function () {
    const file = 'scripts/Script1/Script1.gml';
    const text = script1Text + '\n/// @\n/// @param {Str} x\nglob';
    await client.connection.sendNotification('textDocument/didChange', {
      textDocument: { uri: client.uri(file), version: 2 },
      contentChanges: [{ text }],
    });
    const complete = (needle: string, delta: number, trigger?: string) =>
      client.connection.sendRequest('textDocument/completion', {
        textDocument: { uri: client.uri(file) },
        position: client.positionIn(text, needle, 0, delta),
        context: trigger
          ? { triggerKind: 2, triggerCharacter: trigger }
          : { triggerKind: 1 },
      }) as Promise<CompletionItem[] | null>;

    const symbols = await complete('\nglob', 5);
    assert.ok(symbols?.some((i) => i.label === 'global_function'));
    assert.ok(symbols?.some((i) => i.label === 'GLOBAL_SCRIPT_VAR'));

    const tags = await complete('/// @\n', 5, '@');
    assert.ok(tags?.some((i) => i.label === 'param'));

    const types = await complete('{Str', 4);
    assert.ok(types?.some((i) => i.label === 'String'));

    // Restore
    await client.connection.sendNotification('textDocument/didChange', {
      textDocument: { uri: client.uri(file), version: 3 },
      contentChanges: [{ text: script1Text }],
    });
  });

  it('provides signature help', async function () {
    const text = 'global_function(1, );';
    const file = 'scripts/Complicated/Complicated.gml';
    await client.open(file, text);
    const help: SignatureHelp | null = await client.connection.sendRequest(
      'textDocument/signatureHelp',
      {
        textDocument: { uri: client.uri(file) },
        position: { line: 0, character: text.indexOf(')') },
      },
    );
    assert.ok(help);
    assert.equal(help.activeParameter, 1);
    const signature = help.signatures[0];
    const [start, end] = signature.parameters![1].label as [number, number];
    assert.match(signature.label.slice(start, end), /^something_else\?/);
    await client.connection.sendNotification('textDocument/didClose', {
      textDocument: { uri: client.uri(file) },
    });
  });

  it('provides semantic tokens', async function () {
    const tokens: { data: number[] } = await client.connection.sendRequest(
      'textDocument/semanticTokens/full',
      { textDocument: { uri: client.uri(script1) } },
    );
    assert.ok(tokens.data.length > 0);
    assert.equal(tokens.data.length % 5, 0);
  });

  it('finds workspace symbols, including assets', async function () {
    const symbols: SymbolInformation[] = await client.connection.sendRequest(
      'workspace/symbol',
      { query: 'glofun' },
    );
    assert.equal(symbols[0]?.name, 'global_function');
    const assets: SymbolInformation[] = await client.connection.sendRequest(
      'workspace/symbol',
      { query: 'o_child1' },
    );
    assert.ok(assets.some((s) => s.name === 'o_child1'));
  });

  it('formats documents, but not ones with syntax errors', async function () {
    const file = 'scripts/Futures/Futures.gml';
    await client.open(file, 'var a=1\nif(a){b=2}');
    const edits: TextEdit[] = await client.connection.sendRequest(
      'textDocument/formatting',
      {
        textDocument: { uri: client.uri(file) },
        options: { tabSize: 4, insertSpaces: false },
      },
    );
    assert.equal(edits.length, 1);
    assert.match(edits[0].newText, /var a = 1;/);

    await client.connection.sendNotification('textDocument/didChange', {
      textDocument: { uri: client.uri(file), version: 2 },
      contentChanges: [{ text: 'var a = (;' }],
    });
    const none: TextEdit[] = await client.connection.sendRequest(
      'textDocument/formatting',
      {
        textDocument: { uri: client.uri(file) },
        options: { tabSize: 4, insertSpaces: false },
      },
    );
    assert.deepEqual(none, []);
    await client.connection.sendNotification('textDocument/didClose', {
      textDocument: { uri: client.uri(file) },
    });
  });

  it('describes symbols for the client', async function () {
    const info: SymbolInfo | null = await client.connection.sendRequest(
      symbolInfoRequest,
      at('GlobalConstructor', 1),
    );
    assert.equal(info?.name, 'GlobalConstructor');
    assert.equal(info?.native, false);
    assert.equal(info?.constructs, 'Struct.GlobalConstructor');

    const asset: SymbolInfo | null = await client.connection.sendRequest(
      symbolInfoRequest,
      at('o_parent'),
    );
    assert.equal(asset?.kind, 'asset');
    assert.equal(asset?.assetKind, 'objects');
  });

  it("lists the project's global names", async function () {
    const names: string[] =
      await client.connection.sendRequest(globalNamesRequest);
    assert.ok(names.includes('global_function'));
    assert.ok(names.includes('o_parent'));
    assert.ok(!names.includes('show_debug_message'));
  });

  it('provides code edits for renaming an asset', async function () {
    const edit: WorkspaceEdit = await client.connection.sendRequest(
      assetRenameEditsRequest,
      { name: 'o_parent', newName: 'o_renamed' },
    );
    const edits = Object.entries(edit.changes!);
    assert.ok(edits.length >= 1);
    assert.ok(
      edits.some(
        ([uri, e]) =>
          uri === client.uri(script1) && e[0].newText === 'o_renamed',
      ),
    );
  });

  it('updates diagnostics as documents change', async function () {
    const file = 'scripts/Recovery/Recovery.gml';
    await client.open(file, 'var x = undeclared_thing_123;');
    await client.waitForDiagnostics(file, (p) =>
      p.diagnostics.some((d) =>
        String(d.message).includes('undeclared_thing_123'),
      ),
    );
    await client.connection.sendNotification('textDocument/didChange', {
      textDocument: { uri: client.uri(file), version: 2 },
      contentChanges: [{ text: 'var x = 1;' }],
    });
    await client.waitForDiagnostics(
      file,
      (p) =>
        !p.diagnostics.some((d) =>
          String(d.message).includes('undeclared_thing_123'),
        ),
    );
    await client.connection.sendNotification('textDocument/didClose', {
      textDocument: { uri: client.uri(file) },
    });
  });

  it('follows changes on disk', async function () {
    const file = 'scripts/Reactions/Reactions.gml';
    const absolute = path.join(client.dir, file);
    await fs.writeFile(absolute, 'function brand_new_function() {}\n');
    await client.connection.sendNotification(
      'workspace/didChangeWatchedFiles',
      { changes: [{ uri: client.uri(file), type: 2 }] },
    );
    // A new global function nothing calls
    await client.waitForDiagnostics(file, (p) =>
      p.diagnostics.some(
        (d) =>
          d.code === 'unused-function' &&
          String(d.message).includes('brand_new_function'),
      ),
    );
    const symbols: SymbolInformation[] = await client.connection.sendRequest(
      'workspace/symbol',
      { query: 'brand_new_function' },
    );
    assert.equal(symbols[0]?.name, 'brand_new_function');
  });

  it('applies settings', async function () {
    const file = 'scripts/Reactions/Reactions.gml';
    await client.connection.sendNotification(
      'workspace/didChangeConfiguration',
      { settings: { diagnostics: { suppressGroups: ['Scripts'] } } },
    );
    await client.waitForDiagnostics(file, (p) => p.diagnostics.length === 0);
    await client.connection.sendNotification(
      'workspace/didChangeConfiguration',
      { settings: { diagnostics: { missingDocs: 'warning' } } },
    );
    await client.waitForDiagnostics(file, (p) =>
      p.diagnostics.some((d) => d.code === 'missing-docs'),
    );
  });
});
