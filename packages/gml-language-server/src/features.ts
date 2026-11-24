/**
 * LSP features, as functions from a session and a file position to LSP
 * results. These are pure translations of `GmlQueries` results (plus some
 * project knowledge, like where an asset's files are).
 */
import type { Asset } from '@bscotch/gamemaker-project';
import {
  fileDiagnostics,
  formatUnion,
  ids,
  type DiagnosticOptions,
  type FunctionEntry,
  type Location as GmlLocation,
  type SymbolEntry,
  type Type,
} from '@bscotch/gml-parser';
import { formatGml, GmlFormatError } from '@bscotch/gml-formatter';
import { LineIndex } from '@bscotch/gml-syntax';
import { readFileSync } from 'node:fs';
import {
  CompletionItemKind,
  DiagnosticSeverity,
  DiagnosticTag,
  SemanticTokensBuilder,
  SymbolKind,
  type CompletionItem,
  type Diagnostic,
  type Hover,
  type Location,
  type Range,
  type SemanticTokens,
  type SignatureHelp,
  type SymbolInformation,
  type TextEdit,
  type WorkspaceEdit,
} from 'vscode-languageserver/node';
import {
  semanticTokenModifiers,
  semanticTokenTypes,
  type DiagnosticLevel,
  type GmlServerSettings,
  type SymbolInfo,
} from './protocol.ts';
import type { ProjectSession } from './session.ts';
import { pathToUri } from './uri.ts';

//#region Positions

/** The line index for a file: from its analysis, else read from disk */
export function linesOf(session: ProjectSession, fileId: string): LineIndex {
  const parsed = session.analyzer.getFile(fileId);
  if (parsed) return parsed.lines;
  let text = '';
  try {
    text = readFileSync(session.pathOf(fileId), 'utf8');
  } catch {
    // (A missing file: positions all map to the start)
  }
  return new LineIndex(text);
}

export function rangeOf(lines: LineIndex, start: number, end: number): Range {
  return { start: lines.positionAt(start), end: lines.positionAt(end) };
}

export function toLocation(
  session: ProjectSession,
  loc: GmlLocation,
  lines = linesOf(session, loc.file),
): Location {
  return {
    uri: pathToUri(session.pathOf(loc.file)),
    range: rangeOf(lines, loc.start, loc.end),
  };
}

function fileStart(file: string): Location {
  const zero = { line: 0, character: 0 };
  return { uri: pathToUri(file), range: { start: zero, end: zero } };
}

//#endregion

//#region Diagnostics

const severities = {
  error: DiagnosticSeverity.Error,
  warning: DiagnosticSeverity.Warning,
  info: DiagnosticSeverity.Information,
  hint: DiagnosticSeverity.Hint,
} as const;

export function diagnosticOptions(
  settings: GmlServerSettings,
): DiagnosticOptions {
  const d = settings.diagnostics ?? {};
  return {
    autoDeclareGlobalsPrefixes: d.autoDeclaredGlobalsPrefixes,
    missingDocs: d.missingDocs ?? 'off',
    mixedOperators: d.mixedOperators ?? 'off',
    argumentEvaluationOrder: d.argumentEvaluationOrder ?? 'off',
    argumentTypes: d.argumentTypes ?? 'warning',
  };
}

/** Whether a file is in a folder whose diagnostics are suppressed */
export function isSuppressed(
  session: ProjectSession,
  fileId: string,
  settings: GmlServerSettings,
): boolean {
  const groups = settings.diagnostics?.suppressGroups;
  if (!groups?.length) return false;
  const assetName = session.sourceFile(fileId)?.asset;
  const asset = assetName ? session.project.getAsset(assetName) : undefined;
  return !!asset && groups.some((g) => asset.isInFolder(g));
}

export function diagnostics(
  session: ProjectSession,
  fileId: string,
  settings: GmlServerSettings,
): Diagnostic[] {
  if (isSuppressed(session, fileId, settings)) return [];
  const lines = linesOf(session, fileId);
  return fileDiagnostics(
    session.analyzer,
    fileId,
    diagnosticOptions(settings),
  ).map((d) => ({
    range: rangeOf(lines, d.start, d.end),
    severity: severities[d.severity],
    code: d.code,
    source: 'stitch',
    message: d.message,
    tags:
      d.code === 'unused-function' ? [DiagnosticTag.Unnecessary] : undefined,
  }));
}

export function isDiagnosticLevel(value: unknown): value is DiagnosticLevel {
  return ['error', 'warning', 'info', 'hint', 'off'].includes(value as string);
}

//#endregion

//#region Hover

export function hover(
  session: ProjectSession,
  fileId: string,
  offset: number,
): Hover | null {
  const info = session.queries.hover(fileId, offset);
  if (!info) return null;
  const parts = info.code.map((code) => '```gml\n' + code + '\n```');
  parts.push(...info.text);
  const sprite =
    info.symbol.kind === 'asset' && info.symbol.assetKind === 'sprites'
      ? session.project.getAsset(info.symbol.name)
      : undefined;
  if (sprite) {
    const frames = sprite.framePaths
      .slice(0, 16)
      .map((frame) => `![Sprite frame](${pathToUri(frame)})`);
    if (frames.length) parts.push(frames.join(' '));
  }
  return {
    contents: { kind: 'markdown', value: parts.join('\n\n') },
    range: rangeOf(linesOf(session, fileId), info.start, info.end),
  };
}

//#endregion

//#region Navigation

/** Where to go to "see" an asset: an object's Create event, a sound's file, ... */
export function assetLocation(asset: Asset): Location {
  if (asset.isKind('objects')) {
    const events = asset.listEvents();
    const preferred =
      events.find((e) => e.event.name === 'Create_0') ??
      events.find((e) => e.event.name === 'Step_0');
    const file = preferred?.file ?? asset.gmlFiles[0];
    if (file) return fileStart(file);
  } else if (asset.isKind('shaders') && asset.shaderPaths) {
    return fileStart(asset.shaderPaths.fragment);
  } else if (asset.isKind('sounds') && asset.soundFile) {
    return fileStart(asset.soundFile);
  } else if (asset.gmlFiles[0]) {
    return fileStart(asset.gmlFiles[0]);
  }
  return fileStart(asset.yyPath);
}

/**
 * For `event_inherited()`, the same event in the nearest ancestor that has it
 */
function inheritedEvent(
  session: ProjectSession,
  fileId: string,
): Location | undefined {
  const source = session.sourceFile(fileId);
  if (source?.kind !== 'objectEvent' || !source.event) return undefined;
  for (const ancestor of session.project.getAncestors(source.asset)) {
    const file = ancestor.getEventFile(source.event);
    if (file) return fileStart(file);
  }
  return undefined;
}

function instanceObjectName(type: Type): string | undefined {
  return type.kind === 'Id.Instance' || type.kind === 'Asset.GMObject'
    ? type.name
    : undefined;
}

export function definition(
  session: ProjectSession,
  fileId: string,
  offset: number,
): Location[] {
  const { queries, project } = session;
  const symbol = queries.symbolOf(queries.referenceAt(fileId, offset));
  if (!symbol) return [];
  if (symbol.native) {
    if (symbol.name === 'event_inherited') {
      const parent = inheritedEvent(session, fileId);
      return parent ? [parent] : [];
    }
    return [];
  }
  if (symbol.def) return [toLocation(session, symbol.def)];
  if (symbol.kind === 'asset') {
    const asset = project.getAsset(symbol.name);
    return asset ? [assetLocation(asset)] : [];
  }
  for (const type of symbol.type) {
    const name = instanceObjectName(type);
    const asset = name ? project.getAsset(name) : undefined;
    if (asset) return [assetLocation(asset)];
  }
  return [];
}

export function typeDefinition(
  session: ProjectSession,
  fileId: string,
  offset: number,
): Location[] {
  const locations = session.queries
    .typeDefinition(fileId, offset)
    .map((loc) => toLocation(session, loc));
  if (locations.length) return locations;
  // Instance types: the object
  const symbol = session.queries.symbolOf(
    session.queries.referenceAt(fileId, offset),
  );
  for (const type of symbol?.type ?? []) {
    const name = instanceObjectName(type);
    const asset = name ? session.project.getAsset(name) : undefined;
    if (asset) locations.push(assetLocation(asset));
  }
  return locations;
}

export function references(
  session: ProjectSession,
  fileId: string,
  offset: number,
  includeDeclaration: boolean,
): Location[] {
  const cache = new Map<string, LineIndex>();
  return session.queries
    .references(fileId, offset, { includeDeclaration })
    .map((ref) => {
      let lines = cache.get(ref.file);
      if (!lines) cache.set(ref.file, (lines = linesOf(session, ref.file)));
      return toLocation(session, ref, lines);
    });
}

//#endregion

//#region Rename

export class RenameError extends Error {}

/** The range to rename, or throws a {@link RenameError} saying why it can't be */
export function prepareRename(
  session: ProjectSession,
  fileId: string,
  offset: number,
): Range {
  const target = session.queries.canRename(fileId, offset);
  if (target) {
    return rangeOf(linesOf(session, fileId), target.start, target.end);
  }
  const ref = session.queries.referenceAt(fileId, offset);
  const symbol = session.queries.symbolOf(ref);
  if (!ref) throw new RenameError('There is no symbol here to rename.');
  if (symbol?.native) {
    throw new RenameError('Built-in symbols cannot be renamed.');
  }
  if (symbol?.kind === 'asset') {
    throw new RenameError('Rename assets from the Stitch asset tree.');
  }
  if (ref.keyword) {
    throw new RenameError('`self` and `other` cannot be renamed.');
  }
  throw new RenameError('This symbol cannot be renamed.');
}

function toWorkspaceEdit(
  session: ProjectSession,
  edits: { file: string; start: number; end: number; newText: string }[],
): WorkspaceEdit {
  const changes: Record<string, TextEdit[]> = {};
  const linesCache = new Map<string, LineIndex>();
  for (const edit of edits) {
    let lines = linesCache.get(edit.file);
    if (!lines)
      linesCache.set(edit.file, (lines = linesOf(session, edit.file)));
    const uri = pathToUri(session.pathOf(edit.file));
    (changes[uri] ||= []).push({
      range: rangeOf(lines, edit.start, edit.end),
      newText: edit.newText,
    });
  }
  return { changes };
}

export function rename(
  session: ProjectSession,
  fileId: string,
  offset: number,
  newName: string,
): WorkspaceEdit {
  prepareRename(session, fileId, offset);
  try {
    return toWorkspaceEdit(
      session,
      session.queries.renameEdits(fileId, offset, newName),
    );
  } catch (err) {
    throw new RenameError((err as Error).message);
  }
}

/** The code edits for renaming an asset (its files are renamed separately) */
export function assetRenameEdits(
  session: ProjectSession,
  name: string,
  newName: string,
): WorkspaceEdit {
  const symbol = session.analyzer.table.findMember(ids.globalShape, name);
  if (!symbol || symbol.kind !== 'asset') return { changes: {} };
  const edits = session.queries
    .referencesTo(symbol.id)
    .filter((ref) => !ref.keyword)
    .map((ref) => ({ ...ref, newText: newName }));
  return toWorkspaceEdit(session, edits);
}

//#endregion

//#region Completion

/** Doc comment tags, for completions after `@` */
const docTags: [tag: string, description: string][] = [
  ['param', 'Describe a function parameter: `@param {Type} name Description`'],
  [
    'returns',
    'Describe what a function returns: `@returns {Type} Description`',
  ],
  ['description', 'Describe a function, variable, or other symbol'],
  ['self', 'The type of `self` in a function: `@self {Struct.Foo}`'],
  ['type', 'Declare the type of a variable: `@type {Type}`'],
  ['template', 'Declare a generic type parameter: `@template T`'],
  ['localvar', 'Declare a local variable: `@localvar {Type} name`'],
  ['globalvar', 'Declare a global variable: `@globalvar {Type} name`'],
  ['instancevar', 'Declare an instance variable: `@instancevar {Type} name`'],
  ['deprecated', 'Mark a symbol as deprecated'],
  ['mixin', 'Calling this function adds its variables to the caller'],
  ['see', 'Link to a related symbol: `@see symbol_name`'],
  ['function', 'Name a function: `@function name(params)`'],
  ['pure', 'The function has no side effects'],
  ['ignore', 'Hide the function from autocomplete in GameMaker'],
];

/** Where the cursor is inside a doc comment */
function docCommentContext(
  text: string,
  docStart: number,
  offset: number,
): 'tag' | 'type' | undefined {
  const lineStart = Math.max(docStart, text.lastIndexOf('\n', offset - 1) + 1);
  const before = text.slice(lineStart, offset);
  if (/@[A-Za-z]*$/.test(before) && !/\{[^}]*$/.test(before)) return 'tag';
  if (/\{[^}]*$/.test(before)) return 'type';
  return undefined;
}

function completionKind(
  session: ProjectSession,
  symbol: SymbolEntry,
): CompletionItemKind {
  const fn = session.analyzer.table.getFunction(symbol.fn);
  switch (symbol.kind) {
    case 'enum':
      return CompletionItemKind.Enum;
    case 'enumMember':
      return CompletionItemKind.EnumMember;
    case 'constructor':
      return CompletionItemKind.Constructor;
    case 'macro':
    case 'constant':
      return CompletionItemKind.Constant;
    case 'asset':
      return CompletionItemKind.Reference;
  }
  if (fn?.isConstructor) return CompletionItemKind.Constructor;
  if (symbol.kind === 'function' || fn) {
    return symbol.instance
      ? CompletionItemKind.Method
      : CompletionItemKind.Function;
  }
  if (symbol.instance) return CompletionItemKind.Field;
  return CompletionItemKind.Variable;
}

function completionDetail(symbol: SymbolEntry): string {
  const details = [formatUnion(symbol.type) || 'Any'];
  if (symbol.native) details.push('native');
  if (symbol.global) details.push('global');
  if (symbol.local) details.push('local');
  if (symbol.parameter) details.push('parameter');
  return details.join(' ');
}

/** Sort group: locals, then instance members, then project globals, then built-ins */
function sortGroup(symbol: SymbolEntry): number {
  if (symbol.local || symbol.parameter) return 0;
  if (symbol.native) return 3;
  if (symbol.instance || !symbol.global) return 1;
  return 2;
}

export function completions(
  session: ProjectSession,
  fileId: string,
  offset: number,
  triggerCharacter: string | undefined,
  settings: GmlServerSettings,
): CompletionItem[] | null {
  const { queries } = session;
  const doc = queries.docCommentAt(fileId, offset);
  if (doc) {
    const text = session.analyzer.getFile(fileId)?.text ?? '';
    const context = docCommentContext(text, doc.start, offset);
    if (context === 'tag') {
      return docTags.map(([tag, description]) => ({
        label: tag,
        kind: CompletionItemKind.Keyword,
        documentation: { kind: 'markdown', value: description },
      }));
    }
    if (context === 'type' && triggerCharacter !== '.') {
      return queries.typeNames().map((name) => ({
        label: name,
        kind: CompletionItemKind.Interface,
      }));
    }
    return null;
  }
  // The other trigger characters only matter in doc comments
  if (triggerCharacter && triggerCharacter !== '.') return null;

  const symbols =
    queries.structMembersAt(fileId, offset) ??
    queries.symbolsInScopeAt(fileId, offset);
  const ignoredPrefix = settings.completion?.ignoredPrefix;
  const items: CompletionItem[] = [];
  for (const symbol of symbols) {
    if (!symbol.name) continue;
    if (
      ignoredPrefix &&
      symbol.name.startsWith(ignoredPrefix) &&
      !symbol.local &&
      !symbol.parameter &&
      symbol.def?.file !== fileId
    ) {
      continue;
    }
    items.push({
      label: symbol.name,
      kind: completionKind(session, symbol),
      detail: completionDetail(symbol),
      sortText: `${sortGroup(symbol)}${symbol.name.toLowerCase()}`,
      tags: symbol.deprecated ? [1 /* Deprecated */] : undefined,
    });
  }
  return items;
}

//#endregion

//#region Signature help

/** A function's signature, with each parameter's position in it */
export function signatureParts(
  session: ProjectSession,
  fn: FunctionEntry,
): {
  label: string;
  params: { symbol: SymbolEntry | undefined; range: [number, number] }[];
} {
  const label = session.queries.formatSignature(fn);
  let cursor = label.indexOf('(') + 1;
  const params = fn.params.map((id) => {
    const symbol = session.analyzer.table.getSymbol(id);
    const part = symbol
      ? `${symbol.name}${symbol.optional ? '?' : ''}: ${formatUnion(symbol.type)}`
      : '?';
    const start = Math.max(cursor, label.indexOf(part, cursor));
    cursor = start + part.length;
    return { symbol, range: [start, cursor] as [number, number] };
  });
  return { label, params };
}

export function signatureHelp(
  session: ProjectSession,
  fileId: string,
  offset: number,
): SignatureHelp | null {
  const arg = session.queries.argumentAt(fileId, offset);
  const fn = arg ? session.analyzer.table.getFunction(arg.fn) : undefined;
  if (!arg || !fn) return null;
  const { label, params } = signatureParts(session, fn);
  const last = params.at(-1)?.symbol;
  const activeParameter =
    arg.idx >= params.length && last?.name === '...'
      ? params.length - 1
      : arg.idx;
  return {
    signatures: [
      {
        label,
        documentation: fn.description
          ? { kind: 'markdown', value: fn.description }
          : undefined,
        parameters: params.map((p) => ({
          label: p.range,
          documentation: p.symbol?.description
            ? { kind: 'markdown', value: p.symbol.description }
            : undefined,
        })),
        activeParameter,
      },
    ],
    activeSignature: 0,
    activeParameter,
  };
}

//#endregion

//#region Semantic tokens

const tokenTypeIndex = new Map<string, number>(
  semanticTokenTypes.map((t, i) => [t, i]),
);
const tokenModifierBit = new Map<string, number>(
  semanticTokenModifiers.map((m, i) => [m, 1 << i]),
);

export function semanticTokens(
  session: ProjectSession,
  fileId: string,
): SemanticTokens {
  const lines = linesOf(session, fileId);
  const builder = new SemanticTokensBuilder();
  const tokens = [...session.queries.semanticTokens(fileId)].sort(
    (a, b) => a.start - b.start,
  );
  let lastEnd = -1;
  for (const token of tokens) {
    // Tokens must not overlap
    if (token.start < lastEnd) continue;
    const start = lines.positionAt(token.start);
    const end = lines.positionAt(token.end);
    if (end.line !== start.line) continue;
    let modifiers = 0;
    for (const m of token.modifiers) modifiers |= tokenModifierBit.get(m) ?? 0;
    builder.push(
      start.line,
      start.character,
      end.character - start.character,
      tokenTypeIndex.get(token.type) ?? 1,
      modifiers,
    );
    lastEnd = token.end;
  }
  return builder.build();
}

//#endregion

//#region Workspace symbols

/** Fuzzy match: the query's characters, in order (case-insensitive) */
function fuzzyScore(query: string, name: string): number {
  const lowerName = name.toLowerCase();
  const lowerQuery = query.toLowerCase();
  if (lowerName === lowerQuery) return 100;
  let from = 0;
  let first = -1;
  let last = -1;
  for (const char of lowerQuery) {
    const idx = lowerName.indexOf(char, from);
    if (idx < 0) return 0;
    if (first < 0) first = idx;
    last = idx;
    from = idx + 1;
  }
  const span = last - first + 1;
  // Tighter matches, earlier matches, and shorter names are better
  return (
    (query.length / span) * 2 +
    (1 - first / name.length) +
    query.length / name.length
  );
}

function symbolKindOf(
  session: ProjectSession,
  symbol: SymbolEntry,
): SymbolKind {
  const fn = session.analyzer.table.getFunction(symbol.fn);
  switch (symbol.kind) {
    case 'enum':
      return SymbolKind.Enum;
    case 'enumMember':
      return SymbolKind.EnumMember;
    case 'macro':
    case 'constant':
      return SymbolKind.Constant;
    case 'constructor':
      return SymbolKind.Constructor;
  }
  if (fn?.isConstructor) return SymbolKind.Constructor;
  if (symbol.kind === 'function' || fn) {
    return symbol.instance ? SymbolKind.Method : SymbolKind.Function;
  }
  return symbol.instance ? SymbolKind.Field : SymbolKind.Variable;
}

export function workspaceSymbols(
  session: ProjectSession,
  query: string,
  settings: GmlServerSettings,
  /** The file in the active editor, whose local variables are included */
  activeFileId?: string,
): SymbolInformation[] {
  query = query.trim();
  if (!query) return [];
  const options = settings.workspaceSymbols ?? {};
  const includeInstance = options.includeInstanceVariables ?? true;
  const includeLocals = options.includeLocalVariables ?? true;
  const max = options.maxResults || 30;
  const { table } = session.analyzer;

  const found: { score: number; info: SymbolInformation }[] = [];
  const seen = new Set<string>();
  const linesCache = new Map<string, LineIndex>();
  const location = (loc: GmlLocation) => {
    let lines = linesCache.get(loc.file);
    if (!lines) linesCache.set(loc.file, (lines = linesOf(session, loc.file)));
    return toLocation(session, loc, lines);
  };
  const add = (
    key: string,
    name: string,
    make: () => Omit<SymbolInformation, 'name'>,
  ) => {
    if (seen.has(key)) return;
    const score = fuzzyScore(query, name);
    if (score <= 0) return;
    seen.add(key);
    found.push({ score, info: { name, ...make() } });
  };

  // Code symbols
  for (const { symbol, container } of session.queries.workspaceSymbols()) {
    if (!symbol.def) continue;
    const shape = table.getShape(symbol.owner);
    if (
      !includeInstance &&
      (shape?.kind === 'object' || shape?.kind === 'struct')
    ) {
      continue;
    }
    add(symbol.id, symbol.name, () => ({
      kind: symbolKindOf(session, symbol),
      containerName: container,
      location: location(symbol.def!),
    }));
  }

  // Assets
  for (const asset of session.project.assets) {
    if (asset.isKind('scripts')) {
      // Scripts usually declare a function of the same name, already listed
      const fn = table.findMember(ids.globalShape, asset.name);
      if (fn?.def && fn.kind !== 'asset') continue;
    }
    const kind = asset.isKind('objects')
      ? SymbolKind.Class
      : asset.isKind('scripts') || asset.isKind('shaders')
        ? SymbolKind.Module
        : SymbolKind.File;
    add(`asset:${asset.name}`, asset.name, () => ({
      kind,
      containerName: asset.kind,
      location: assetLocation(asset),
    }));
  }

  // Locals of the active file
  if (includeLocals && activeFileId) {
    for (const fileId of [activeFileId]) {
      const shapes = new Set(
        session.analyzer.getAnalysis(fileId)?.scopes.map((s) => s.local),
      );
      for (const shape of shapes) {
        for (const symbol of table.listMembers(shape)) {
          if (symbol.def?.file !== fileId) continue;
          add(symbol.id, symbol.name, () => ({
            kind: SymbolKind.Variable,
            containerName: 'local',
            location: location(symbol.def!),
          }));
        }
      }
    }
  }

  return found
    .sort((a, b) => b.score - a.score || a.info.name.localeCompare(b.info.name))
    .slice(0, max)
    .map((f) => f.info);
}

//#endregion

//#region Symbol info

export function symbolInfo(
  session: ProjectSession,
  fileId: string,
  offset: number,
): SymbolInfo | null {
  const { queries } = session;
  const symbol = queries.symbolOf(queries.referenceAt(fileId, offset));
  if (!symbol) return null;
  const fn = session.analyzer.table.getFunction(symbol.fn);
  const constructs =
    fn?.isConstructor && fn.self ? formatUnion([fn.self]) : undefined;
  return {
    name: symbol.name,
    kind: symbol.kind,
    native: !!symbol.native,
    assetKind: symbol.assetKind,
    type: formatUnion(symbol.type) || 'Any',
    constructs,
    deprecated: symbol.deprecated || undefined,
  };
}

//#endregion

//#region Formatting

export function formatDocument(
  text: string,
  settings: GmlServerSettings,
): { edits: TextEdit[]; error?: string } {
  let formatted: string;
  try {
    formatted = formatGml(text, {
      preset: settings.format?.preset ?? 'bscotch',
    }).text;
  } catch (err) {
    if (err instanceof GmlFormatError) {
      return { edits: [], error: err.message };
    }
    throw err;
  }
  if (formatted === text) return { edits: [] };
  const lines = new LineIndex(text);
  return {
    edits: [{ range: rangeOf(lines, 0, text.length), newText: formatted }],
  };
}

//#endregion
