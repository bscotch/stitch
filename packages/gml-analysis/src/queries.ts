/**
 * Editor queries over analysis results: what's at a position, what's in
 * scope, where things are declared and used.
 */
import type { GmlAnalyzer } from './analyzer.ts';
import type { ArgumentRange, Reference, ScopeRange } from './analysis.types.ts';
import type { DocComment } from '@bscotch/gml-syntax';
import {
  ids,
  type FunctionEntry,
  type Location,
  type SymbolEntry,
} from './symbols.ts';
import {
  formatType,
  formatUnion,
  normalizeKind,
  primitiveKinds,
  type Type,
} from './types.ts';

export type SemanticTokenType =
  | 'function'
  | 'variable'
  | 'enum'
  | 'macro'
  | 'class'
  | 'enumMember'
  | 'parameter'
  | 'property';
export type SemanticTokenModifier =
  | 'readonly'
  | 'defaultLibrary'
  | 'declaration'
  | 'static'
  | 'deprecated'
  | 'local'
  | 'asset'
  | 'global';

export interface SemanticToken {
  start: number;
  end: number;
  type: SemanticTokenType;
  modifiers: SemanticTokenModifier[];
}

export interface HoverInfo {
  start: number;
  end: number;
  symbol: SymbolEntry;
  /** Code blocks (GML), e.g. a function signature or a type */
  code: string[];
  /** Markdown blocks: the description and type details */
  text: string[];
}

export interface TextEdit {
  file: string;
  start: number;
  end: number;
  newText: string;
}

export interface WorkspaceSymbol {
  name: string;
  symbol: SymbolEntry;
  /** The name of the containing object, struct or enum, if any */
  container?: string;
  location: Location;
}

/** Names that can't be renamed (or renamed to) */
const reservedNames = new Set(
  (
    'self other global all noone undefined true false function var static ' +
    'globalvar return if else while do until for repeat with switch case ' +
    'default break continue exit try catch finally throw new delete enum ' +
    'constructor and or not xor mod div begin end then'
  ).split(' '),
);

/** The innermost item containing an offset (inclusive of its end) */
function innermost<T extends { start: number; end: number }>(
  items: readonly T[],
  offset: number,
): T | undefined {
  let best: T | undefined;
  for (const item of items) {
    if (item.start > offset || item.end < offset) continue;
    if (!best || item.end - item.start <= best.end - best.start) best = item;
  }
  return best;
}

export class GmlQueries {
  readonly analyzer: GmlAnalyzer;

  constructor(analyzer: GmlAnalyzer) {
    this.analyzer = analyzer;
  }

  protected get table() {
    return this.analyzer.table;
  }

  /** The reference at an offset, if any */
  referenceAt(fileId: string, offset: number): Reference | undefined {
    const refs = this.analyzer.getAnalysis(fileId)?.refs ?? [];
    // Binary search on start
    let low = 0;
    let high = refs.length - 1;
    while (low <= high) {
      const mid = (low + high) >> 1;
      const ref = refs[mid];
      if (ref.end < offset) low = mid + 1;
      else if (ref.start > offset) high = mid - 1;
      else return ref;
    }
    return undefined;
  }

  /** The symbol a reference points to (undefined for undeclared variables) */
  symbolOf(ref: Reference | undefined): SymbolEntry | undefined {
    return ref ? this.table.getSymbol(ref.symbol) : undefined;
  }

  /** Whether a reference is the declaration of its symbol */
  isDeclaration(fileId: string, ref: Reference): boolean {
    const def = this.table.getSymbol(ref.symbol)?.def;
    return !!def && def.file === fileId && def.start === ref.start;
  }

  scopeAt(fileId: string, offset: number): ScopeRange | undefined {
    return innermost(this.analyzer.getAnalysis(fileId)?.scopes ?? [], offset);
  }

  /**
   * The symbols that can be referenced at an offset: locals, then `self`
   * members, then globals. After a `.`, only members of what's before it.
   */
  symbolsInScopeAt(fileId: string, offset: number): SymbolEntry[] {
    const scope = this.scopeAt(fileId, offset);
    if (!scope) return [];
    const table = this.table;
    const usable = (s: SymbolEntry) => !!s.def || !!s.native;
    if (scope.dot) {
      if (scope.self === ids.globalShape || !scope.self) {
        // `global.`: only things defined in the project that live on `global`
        return table
          .listMembers(ids.globalShape)
          .filter(
            (s) =>
              !s.native && s.def && s.kind !== 'macro' && s.kind !== 'enum',
          );
      }
      return table.listMembers(scope.self).filter(usable);
    }
    const found = new Map<string, SymbolEntry>();
    const add = (symbols: SymbolEntry[]) => {
      for (const s of symbols) {
        if (!found.has(s.name) && usable(s)) found.set(s.name, s);
      }
    };
    add(table.listMembers(scope.local));
    if (scope.self && scope.self !== ids.globalShape)
      add(table.listMembers(scope.self));
    add(table.listMembers(ids.globalShape));
    return [...found.values()];
  }

  /** The function-call argument at an offset (innermost), for signature help */
  argumentAt(fileId: string, offset: number): ArgumentRange | undefined {
    return innermost(
      this.analyzer.getAnalysis(fileId)?.argumentRanges ?? [],
      offset,
    );
  }

  /** The parameter an argument corresponds to */
  parameterFor(arg: ArgumentRange): SymbolEntry | undefined {
    const fn = this.table.getFunction(arg.fn);
    return this.table.getSymbol(fn?.params[arg.idx]);
  }

  /** Every reference to a symbol, across the project */
  referencesTo(symbolId: string) {
    return this.analyzer.refIndex.get(symbolId) ?? [];
  }

  //#region Hover and signatures

  /** A function's signature, e.g. `function f(a: Real, b?: String): Bool` */
  formatSignature(fn: FunctionEntry): string {
    const params = fn.params.map((id) => {
      const p = this.table.getSymbol(id);
      if (!p) return '?';
      return `${p.name}${p.optional ? '?' : ''}: ${formatUnion(p.type)}`;
    });
    let text = `function ${fn.name ?? ''}(${params.join(', ')})`;
    if (fn.isConstructor) text += ' constructor';
    const returns = fn.isConstructor && fn.self ? [fn.self] : fn.returns;
    return `${text}: ${returns.length ? formatUnion(returns) : 'Undefined'}`;
  }

  /** The function a type refers to, if any */
  functionOf(type: Type): FunctionEntry | undefined {
    if (type.kind !== 'Function') return undefined;
    return this.table.getFunction(
      type.entity ?? (type.name ? ids.fn(type.name) : undefined),
    );
  }

  /** The shape a type's members come from, if any */
  shapeOf(type: Type): string | undefined {
    if (type.entity && this.table.getShape(type.entity)) return type.entity;
    switch (type.kind) {
      case 'Struct':
        return type.name ? ids.structShape(type.name) : undefined;
      case 'Id.Instance':
      case 'Asset.GMObject':
        return type.name ? ids.objectShape(type.name) : ids.instanceBase;
      case 'Enum':
        return type.name ? ids.enumShape(type.name) : undefined;
    }
    return undefined;
  }

  /** Hover info for the reference at an offset */
  hover(fileId: string, offset: number): HoverInfo | undefined {
    const ref = this.referenceAt(fileId, offset);
    const symbol = this.symbolOf(ref);
    if (!ref || !symbol) return undefined;
    return { start: ref.start, end: ref.end, symbol, ...this.describe(symbol) };
  }

  /** Code and text describing a symbol */
  describe(symbol: SymbolEntry): { code: string[]; text: string[] } {
    const code = new Set<string>();
    const text = new Set<string>();
    if (symbol.description) text.add(symbol.description);
    const fn = this.table.getFunction(symbol.fn);
    if (fn) {
      code.add(this.formatSignature(fn));
      if (fn.description && fn.description !== symbol.description) {
        text.add(fn.description);
      }
      const details = this.functionDetails(fn);
      if (details) text.add(details);
    }
    if (!symbol.type.length && !fn) code.add('Any');
    for (const type of symbol.type) {
      const typeFn = this.functionOf(type);
      if (typeFn) {
        if (typeFn !== fn) code.add(this.formatSignature(typeFn));
        continue;
      }
      code.add(
        symbol.kind === 'enum' ? `enum ${symbol.name}` : formatType(type),
      );
      const details = this.typeDetails(type);
      if (details) text.add(details);
    }
    return { code: [...code], text: [...text] };
  }

  protected functionDetails(fn: FunctionEntry): string {
    const lines: string[] = [];
    if (fn.self && !fn.isConstructor) {
      lines.push(`*@self* \`${formatType(fn.self)}\``);
    }
    for (const id of fn.params) {
      const p = this.table.getSymbol(id);
      if (p?.description) {
        lines.push(`*@param* \`${p.name}\` - ${p.description}`);
      }
    }
    return lines.join('\n\n');
  }

  /** A listing of a struct's or enum's members */
  protected typeDetails(type: Type): string {
    if (type.kind !== 'Struct' && type.kind !== 'Enum') return '';
    const shape = this.shapeOf(type);
    if (!shape || shape === ids.globalShape) return '';
    const underscores = (n: string) => n.match(/^_+/)?.[0].length ?? 0;
    const members = this.table
      .listMembers(shape)
      .filter((m) => m.def || m.native)
      .sort(
        (a, b) =>
          underscores(a.name) - underscores(b.name) ||
          a.name.toLowerCase().localeCompare(b.name.toLowerCase()),
      );
    if (!members.length) return '';
    const lines = members
      .slice(0, 20)
      .map((m) =>
        type.kind === 'Enum'
          ? `  ${m.name},`
          : `  ${m.name}: ${formatUnion(m.type)},`,
      );
    if (members.length > 20) lines.push('  // ... and more!');
    return '```ts\n{\n' + lines.join('\n') + '\n}\n```';
  }

  //#endregion

  //#region Navigation

  /** Where the symbol at an offset is declared */
  definition(fileId: string, offset: number): Location | undefined {
    return this.symbolOf(this.referenceAt(fileId, offset))?.def;
  }

  /** Where the type of the symbol at an offset is declared */
  typeDefinition(fileId: string, offset: number): Location[] {
    const symbol = this.symbolOf(this.referenceAt(fileId, offset));
    const locations: Location[] = [];
    for (const type of symbol?.type ?? []) {
      const shape = this.table.getShape(this.shapeOf(type));
      const named = this.table.getSymbol(shape?.symbol);
      if (named?.def) locations.push(named.def);
      const fn = this.functionOf(type);
      const fnSymbol = this.table.getSymbol(fn?.symbol);
      if (fnSymbol?.def) locations.push(fnSymbol.def);
    }
    return locations;
  }

  /**
   * References to the symbol at an offset (including undeclared names,
   * grouped by what they would be if declared).
   */
  references(
    fileId: string,
    offset: number,
    options?: { includeDeclaration?: boolean },
  ): { file: string; start: number; end: number }[] {
    const ref = this.referenceAt(fileId, offset);
    if (!ref) return [];
    const def = this.table.getSymbol(ref.symbol)?.def;
    return this.referencesTo(ref.symbol).filter(
      (r) =>
        options?.includeDeclaration !== false ||
        !def ||
        r.file !== def.file ||
        r.start !== def.start,
    );
  }

  //#endregion

  //#region Rename

  /**
   * The symbol at an offset, if it can be renamed. Natives, assets (which are
   * renamed along with the project's files) and keywords can't be.
   */
  canRename(
    fileId: string,
    offset: number,
  ): { start: number; end: number; symbol: SymbolEntry } | undefined {
    const ref = this.referenceAt(fileId, offset);
    const symbol = this.symbolOf(ref);
    if (
      !ref ||
      ref.keyword ||
      !symbol ||
      symbol.native ||
      symbol.kind === 'asset'
    ) {
      return undefined;
    }
    if (reservedNames.has(symbol.name) || !symbol.def) return undefined;
    return { start: ref.start, end: ref.end, symbol };
  }

  /** The edits that rename the symbol at an offset. Throws if it can't be renamed. */
  renameEdits(fileId: string, offset: number, newName: string): TextEdit[] {
    const target = this.canRename(fileId, offset);
    if (!target) throw new Error('This symbol cannot be renamed.');
    if (
      !/^[A-Za-z_][A-Za-z0-9_]*$/.test(newName) ||
      reservedNames.has(newName)
    ) {
      throw new Error(`"${newName}" is not a valid name.`);
    }
    const clash = this.table.findMember(target.symbol.owner, newName);
    if (clash && clash.id !== target.symbol.id) {
      throw new Error(`"${newName}" already exists.`);
    }
    // (`self`/`other` refer to the symbol, but not by name)
    return this.referencesTo(target.symbol.id)
      .filter((r) => !r.keyword)
      .map((r) => ({
        file: r.file,
        start: r.start,
        end: r.end,
        newText: newName,
      }));
  }

  //#endregion

  //#region Semantic tokens and symbols

  /** Semantic tokens for every reference in a file */
  semanticTokens(fileId: string): SemanticToken[] {
    const refs = this.analyzer.getAnalysis(fileId)?.refs ?? [];
    const tokens: SemanticToken[] = [];
    for (const ref of refs) {
      const symbol = this.table.getSymbol(ref.symbol);
      const name =
        symbol?.name ?? ref.symbol.slice(ref.symbol.lastIndexOf('/') + 1);
      if (['self', 'other', 'noone', 'all', 'global'].includes(name)) continue;
      if (!symbol) {
        tokens.push({
          start: ref.start,
          end: ref.end,
          type: 'variable',
          modifiers: [],
        });
        continue;
      }
      const fn = this.table.getFunction(symbol.fn);
      let type: SemanticTokenType = 'variable';
      if (symbol.kind === 'enum') type = 'enum';
      else if (symbol.kind === 'enumMember') type = 'enumMember';
      else if (symbol.kind === 'constructor' || fn?.isConstructor)
        type = 'class';
      else if (symbol.kind === 'function' || fn) type = 'function';
      else if (symbol.kind === 'macro') type = 'macro';
      else if (symbol.parameter) type = 'parameter';
      else if (symbol.instance) type = 'property';
      const modifiers = new Set<SemanticTokenModifier>();
      if (symbol.native) modifiers.add('defaultLibrary');
      if (symbol.global) modifiers.add('global');
      if (symbol.local) modifiers.add('local');
      if (symbol.static) modifiers.add('static');
      if (symbol.deprecated) modifiers.add('deprecated');
      if (!symbol.writable) modifiers.add('readonly');
      if (symbol.kind === 'asset') modifiers.add('asset');
      if (symbol.def?.file === fileId && symbol.def.start === ref.start) {
        modifiers.add('declaration');
      }
      tokens.push({
        start: ref.start,
        end: ref.end,
        type,
        modifiers: [...modifiers],
      });
    }
    return tokens;
  }

  /**
   * Project symbols matching a query (case-insensitive substring): globals,
   * and members of objects, constructors and enums.
   */
  workspaceSymbols(query = ''): WorkspaceSymbol[] {
    const q = query.toLowerCase();
    const results: WorkspaceSymbol[] = [];
    const add = (symbol: SymbolEntry, container?: string) => {
      if (!symbol.def || symbol.native) return;
      if (q && !symbol.name.toLowerCase().includes(q)) return;
      results.push({
        name: symbol.name,
        symbol,
        container,
        location: symbol.def,
      });
    };
    for (const symbol of this.table.listMembers(ids.globalShape)) add(symbol);
    for (const shape of this.table.shapes.values()) {
      if (
        shape.id === ids.globalShape ||
        shape.kind === 'local' ||
        !shape.name
      ) {
        continue;
      }
      for (const id of shape.members.values()) {
        const symbol = this.table.getSymbol(id);
        if (symbol && symbol.owner === shape.id) add(symbol, shape.name);
      }
    }
    return results;
  }

  //#endregion

  //#region Completion contexts

  /** The doc comment containing an offset (for tag and type completions) */
  docCommentAt(fileId: string, offset: number): DocComment | undefined {
    return this.analyzer
      .getFile(fileId)
      ?.docs.all.find((d) => d.start <= offset && offset <= d.end);
  }

  /**
   * If the offset is where a new member could be added to a struct literal,
   * the struct's existing members.
   */
  structMembersAt(fileId: string, offset: number): SymbolEntry[] | undefined {
    const range = innermost(
      this.analyzer.getAnalysis(fileId)?.structMemberRanges ?? [],
      offset,
    );
    return range ? this.table.listMembers(range.shape) : undefined;
  }

  /** Type names, for doc-comment type completions */
  typeNames(): string[] {
    const names = new Set<string>(primitiveKinds);
    for (const table of [this.table, this.table.base]) {
      for (const name of table?.types.keys() ?? []) names.add(name);
    }
    return [...names].filter((n) => normalizeKind(n) || n.includes('.')).sort();
  }

  //#endregion
}
