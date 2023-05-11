import type { Pathy } from '@bscotch/pathy';
import { parser, type GmlParsed } from './parser.js';
import type { GameMakerResource } from './project.resource.js';
import { processGlobalSymbols } from './symbols.globals.js';
import { LocalScope, ScopeRange } from './symbols.scopes.js';
import type { ProjectSymbol, SymbolRef } from './symbols.symbol.js';
import { processSymbols } from './symbols.visitor.js';

export class GmlFile {
  readonly kind = 'gml';
  readonly scopeRanges: ScopeRange[] = [];
  /** List of all symbol references in this file, in order of appearance. */
  protected _refs: SymbolRef[] = [];
  protected _content!: string;
  protected _parsed!: GmlParsed;

  constructor(
    readonly resource: GameMakerResource<'objects' | 'scripts'>,
    readonly path: Pathy<string>,
  ) {
    this.scopeRanges.push(
      new ScopeRange(this.self, new LocalScope(this), this),
    );
  }

  get refs() {
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
  async parse(path: Pathy<string>, content?: string) {
    this._content = typeof content === 'string' ? content : await path.read();
    this._parsed = parser.parse(this.content);
  }

  addRef(ref: SymbolRef) {
    this._refs.push(ref);
  }

  clearRefs() {
    // Remove each reference in *this file* from its symbol.
    const cleared = new Set<ProjectSymbol>();
    for (const ref of this._refs) {
      if (cleared.has(ref.symbol) || !ref.symbol.refs.size) {
        continue;
      }
      // If the symbol was declared in this file, remove its location
      if (ref.symbol.location?.file === this) {
        ref.symbol.location = undefined;
      }
      // Remove all references to this symbol found in this file
      for (const symbolRef of ref.symbol.refs) {
        if (symbolRef.location.file === this) {
          ref.symbol.refs.delete(symbolRef);
        }
      }
      cleared.add(ref.symbol);
    }
    // Reset this file's refs list
    this._refs = [];
  }

  /**
   * Reprocess after a modification to the file. Optionally
   * provide new content to use instead of reading from disk.
   */
  async reload(content?: string) {
    await this.parse(this.path, content);
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
