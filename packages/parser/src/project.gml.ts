import type { Pathy } from '@bscotch/pathy';
import { GmlSymbol, GmlSymbolRef, GmlSymbolType } from './gml.js';
import { parser, type GmlParsed } from './parser.js';
import type { GameMakerResource } from './project.resource.js';
import { LocalScope, ScopeRange } from './project.scopes.js';
import { GlobalSymbolType } from './project.selfs.js';
import type {
  LocalVar,
  ProjectSymbolType,
  SelfSymbol,
  SymbolRef,
} from './project.symbols.js';
import { processGlobalSymbols } from './project.visitGlobals.js';
import { processSymbols } from './project.visitLocals.js';
import { Diagnostic } from './types.js';

export class GmlFile {
  readonly type = 'gmlFile';
  readonly scopeRanges: ScopeRange[] = [];
  /** List of all symbol references in this file, in order of appearance. */
  protected _refs: (SymbolRef | GmlSymbolRef)[] = [];
  protected _refsAreSorted = false;
  protected _content!: string;
  protected _parsed!: GmlParsed;

  constructor(
    readonly resource: GameMakerResource<'objects' | 'scripts'>,
    readonly path: Pathy<string>,
  ) {
    this.initializeScopeRanges();
  }

  get isScript() {
    return this.resource.type === 'scripts';
  }

  get isObjectEvent() {
    return this.resource.type === 'objects';
  }

  get isCreateEvent() {
    return this.name === 'Create_0';
  }

  get project() {
    return this.resource.project;
  }

  getReferenceAt(offset: number): SymbolRef | GmlSymbolRef | undefined {
    for (let i = 0; i < this.refs.length; i++) {
      const ref = this.refs[i];
      if (ref.start <= offset && ref.end >= offset) {
        return ref;
      } else if (ref.start > offset) {
        return undefined;
      }
    }
    return undefined;
  }

  getScopeRangeAt(offset: number): ScopeRange | undefined {
    for (const scopeRange of this.scopeRanges) {
      if (offset >= scopeRange.start.startOffset) {
        if (!scopeRange.end || offset <= scopeRange.end.startOffset) {
          return scopeRange;
        }
      }
    }
    return undefined;
  }

  getInScopeSymbolsAt(
    offset: number,
  ): (LocalVar | SelfSymbol | GlobalSymbolType | GmlSymbolType)[] {
    const scopeRange = this.getScopeRangeAt(offset);
    if (!scopeRange) {
      return [];
    }
    const self = scopeRange.self;
    return [
      ...scopeRange.local.symbols.values(), // Local
      ...(self.kind !== 'global' ? self.symbols.values() : []), // Self (if not global)
      ...this.project.self.symbols.values(), // Project globals
      ...this.project.self.gml.values(), // GML globals
    ];
  }

  get refs() {
    if (!this._refsAreSorted) {
      this.sortRefs();
      this._refsAreSorted = true;
    }
    return [...this._refs];
  }

  get self() {
    return this.resource.self;
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
    this._content =
      typeof content === 'string' ? content : await this.path.read();
    this._parsed = parser.parse(this.content);
    const diagnostics: Diagnostic[] = [];
    for (const diagnostic of this._parsed.errors) {
      diagnostics.push({
        type: 'diagnostic',
        kind: 'parser',
        message: diagnostic.message,
        severity: 'error',
        info: diagnostic,
        location: {
          file: this.path.absolute,
          startColumn: diagnostic.token.startColumn!,
          startLine: diagnostic.token.startLine!,
          startOffset: diagnostic.token.startOffset!,
          endColumn: diagnostic.token.endColumn!,
          endLine: diagnostic.token.endLine!,
          endOffset: diagnostic.token.endOffset!,
        },
      });
    }
    if (diagnostics.length) {
      this.project.emitDiagnostics(diagnostics);
    }
  }

  addRef(ref: SymbolRef | GmlSymbolRef) {
    this._refs.push(ref);
  }

  sortRefs() {
    this._refs.sort((a, b) => a.start - b.start);
  }

  protected initializeScopeRanges() {
    this.scopeRanges.length = 0;
    this.scopeRanges.push(
      new ScopeRange(this.self, new LocalScope(this), this),
    );
  }

  clearRefs() {
    this.initializeScopeRanges();
    // Remove each reference in *this file* from its symbol.
    const cleared = new Set<ProjectSymbolType | GmlSymbolType>();
    for (const ref of this._refs) {
      const symbol = ref.symbol;
      if (cleared.has(symbol) || !symbol.refs.size) {
        continue;
      }
      // If the symbol was declared in this file, remove its location
      if (!(symbol instanceof GmlSymbol)) {
        if (symbol.location?.file === this) {
          symbol.location = undefined;
        }
      }
      // Remove all references to this symbol found in this file
      for (const symbolRef of symbol.refs) {
        if (symbolRef.location.file === this) {
          // @ts-expect-error
          symbol.refs.delete(symbolRef);
        }
      }
      cleared.add(symbol);
    }
    // Reset this file's refs list
    this._refs = [];
    this._refsAreSorted = false;
  }

  onRemove() {
    this.clearRefs();
  }

  /**
   * Reprocess after a modification to the file. Optionally
   * provide new content to use instead of reading from disk.
   */
  async reload(content?: string) {
    await this.parse(content);
    this.clearRefs();
    this.updateGlobals();
    this.updateAllSymbols();
  }

  updateGlobals() {
    return processGlobalSymbols(this);
  }

  updateAllSymbols() {
    return processSymbols(this);
  }
}
