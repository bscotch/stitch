import type { Pathy } from '@bscotch/pathy';
import { parser, type GmlParsed } from './parser.js';
import type { Asset } from './project.asset.js';
import { Diagnostic } from './project.diagnostics.js';
import {
  FunctionArgRange,
  LinePosition,
  Position,
  Range,
  Reference,
  ReferenceableType,
  Scope,
} from './project.location.js';
import type { Symbol } from './project.symbol.js';
import { Type, TypeMember } from './project.type.js';
import { processGlobalSymbols } from './project.visitGlobals.js';
import { processSymbols } from './project.visitLocals.js';

/** Represenation of a GML code file. */
export class Code {
  readonly $tag = 'gmlFile';
  readonly scopes: Scope[] = [];
  protected _diagnostics: Diagnostic[] = [];
  /** List of all symbol references in this file, in order of appearance. */
  protected _refs: Reference[] = [];
  protected _functionArgRanges: FunctionArgRange[] = [];
  protected _refsAreSorted = false;
  protected _content!: string;
  protected _parsed!: GmlParsed;

  constructor(readonly asset: Asset, readonly path: Pathy<string>) {}

  get isScript() {
    return this.asset.assetType === 'scripts';
  }

  get isObjectEvent() {
    return this.asset.assetType === 'objects';
  }

  get isCreateEvent() {
    return this.name === 'Create_0';
  }

  get project() {
    return this.asset.project;
  }

  protected isInRange(range: Range, offset: number | LinePosition) {
    if (typeof offset === 'number') {
      return range.start.offset <= offset && range.end.offset >= offset;
    } else {
      return (
        range.start.line === offset.line &&
        range.start.column <= offset.column &&
        range.end.column >= offset.column
      );
    }
  }

  protected isBeforeRange(range: Range, offset: number | LinePosition) {
    if (typeof offset === 'number') {
      return offset < range.end.offset;
    } else {
      return (
        offset.line < range.start.line ||
        (offset.line === range.start.line && offset.column < range.start.column)
      );
    }
  }

  getReferenceAt(offset: number): Reference | undefined;
  getReferenceAt(position: LinePosition): Reference | undefined;
  getReferenceAt(line: number, column: number): Reference | undefined;
  getReferenceAt(
    offset: number | LinePosition,
    column?: number,
  ): Reference | undefined {
    if (typeof offset === 'number' && typeof column === 'number') {
      offset = { line: offset, column };
    }
    for (let i = 0; i < this.refs.length; i++) {
      const ref = this.refs[i];
      if (this.isInRange(ref, offset)) {
        return ref;
      } else if (this.isBeforeRange(ref, offset)) {
        return undefined;
      }
    }
    return undefined;
  }

  getFunctionArgRangeAt(
    offset: number | LinePosition,
  ): FunctionArgRange | undefined {
    let match: FunctionArgRange | undefined;
    const ranges = this.functionArgRanges;
    for (let i = 0; i < ranges.length; i++) {
      const argRange = ranges[i];
      if (this.isInRange(argRange, offset)) {
        // These could be nested, so an outer arg range might contain an inner one.
        // Since these are sorted by start offset, we can return the *last* one to ensure that we're in the innermost range.
        match = argRange;
        continue;
      } else if (this.isBeforeRange(argRange, offset)) {
        return match;
      }
    }
    return match;
  }

  getScopeRangeAt(offset: number | LinePosition): Scope | undefined {
    for (const scopeRange of this.scopes) {
      if (this.isInRange(scopeRange, offset)) {
        return scopeRange;
      }
    }
    // Default to the last scope,
    // since we can end up with wonkiness with EOF trailing whitespace
    return this.scopes.at(-1);
  }

  getInScopeSymbolsAt(
    offset: number | LinePosition,
    column?: number,
  ): (Symbol | TypeMember)[] {
    if (typeof offset === 'number' && typeof column === 'number') {
      offset = { line: offset, column };
    }
    const scopeRange = this.getScopeRangeAt(offset);
    if (!scopeRange) {
      return [];
    }
    if (scopeRange.isDotAccessor) {
      // Then only return self variables
      return scopeRange.self.members || [];
    }
    return [
      // Local variables
      ...(scopeRange.local.members || []),
      // Self variables, if not global
      ...((scopeRange.self !== this.project.self
        ? scopeRange.self.members
        : []) || []),
      // Project globals
      ...this.project.symbols.values(),
      ...(this.project.self.members || []),
      // GML globals
      ...[...this.project.native.global.values()],
    ];
  }

  get refs() {
    if (!this._refsAreSorted) {
      this.sortRefs();
      this._refsAreSorted = true;
    }
    return [...this._refs];
  }

  get functionArgRanges() {
    if (!this._refsAreSorted) {
      this.sortRefs();
      this._refsAreSorted = true;
    }
    return [...this._functionArgRanges];
  }

  get name() {
    return this.path.name;
  }

  get basename() {
    return this.path.basename;
  }

  get content() {
    return this._content;
  }

  get cst() {
    return this._parsed.cst;
  }

  /**
   * Load the file and parse it, resulting in an updated
   * CST for future steps. If content is directly provided,
   * it will be used instead of reading from disk. This
   * is useful for editors that want to provide a live preview.
   */
  async parse(content?: string) {
    this._diagnostics = [];
    this._content =
      typeof content === 'string' ? content : await this.path.read();
    this._parsed = parser.parse(this.content);
    for (const diagnostic of this._parsed.errors) {
      const fromToken = isNaN(diagnostic.token.startOffset)
        ? diagnostic.previousToken
        : diagnostic.token;
      this._diagnostics.push({
        $tag: 'diagnostic',
        kind: 'parser',
        message: diagnostic.message,
        severity: 'error',
        info: diagnostic,
        location: Range.fromCst(this, fromToken || diagnostic.token),
      });
    }
  }

  addRef(ref: Reference) {
    this._refs.push(ref);
  }

  addFunctionArgRange(range: FunctionArgRange) {
    this._functionArgRanges.push(range);
  }

  sortRefs() {
    this._refs.sort((a, b) => a.start.offset - b.start.offset);
    this._functionArgRanges.sort((a, b) => a.start.offset - b.start.offset);
  }

  protected initializeScopeRanges() {
    this.scopes.length = 0;
    const position = Position.fromFileStart(this);
    const self = this.asset.instanceType || this.project.self;
    const local = new Type('Struct');
    this.scopes.push(new Scope(position, local, self));
  }

  reset() {
    this.initializeScopeRanges();
    // Remove each reference in *this file* from its symbol.
    const cleared = new Set<ReferenceableType>();
    for (const ref of this._refs) {
      const symbol = ref.item;
      if (cleared.has(symbol) || !symbol.refs.size) {
        continue;
      }
      const isInThisFile = symbol.def?.file && this === symbol.def.file;
      // If the symbol was declared in this file, remove its location
      if (isInThisFile) {
        symbol.def = undefined;
      }
      // Remove all references to this symbol found in this file
      for (const symbolRef of symbol.refs) {
        if (this === symbolRef.file) {
          symbol.refs.delete(symbolRef);
        }
      }
      cleared.add(symbol);
    }
    // Reset this file's refs list
    this._refs = [];
    this._functionArgRanges = [];
    this._refsAreSorted = false;
  }

  onRemove() {
    this.reset();
  }

  /**
   * Reprocess after a modification to the file. Optionally
   * provide new content to use instead of reading from disk.
   */
  async reload(content?: string) {
    await this.parse(content);
    this.updateGlobals();
    this.updateAllSymbols();
  }

  updateGlobals() {
    this.reset();
    return processGlobalSymbols(this);
  }

  updateAllSymbols() {
    processSymbols(this);

    if (this._diagnostics.length) {
      this.project.emitDiagnostics(this._diagnostics);
    }
  }
}
