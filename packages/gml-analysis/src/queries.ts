/**
 * Editor queries over analysis results: what's at a position, what's in
 * scope, where things are declared and used.
 */
import type { GmlAnalyzer } from './analyzer.ts';
import type { ArgumentRange, Reference, ScopeRange } from './analysis.types.ts';
import { ids, type SymbolEntry } from './symbols.ts';

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
}
