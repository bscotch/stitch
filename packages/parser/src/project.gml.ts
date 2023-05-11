import type { Pathy } from '@bscotch/pathy';
import { parser, type GmlParsed } from './parser.js';
import type { GameMakerResource } from './project.resource.js';
import { processGlobalSymbols } from './symbols.globals.js';
import { LocalScope, ScopeRange } from './symbols.scopes.js';
import type { ProjectSymbol } from './symbols.symbol.js';
import { processSymbols } from './symbols.visitor.js';

export class GmlFile {
  readonly kind = 'gml';
  protected _content!: string;
  protected _parsed!: GmlParsed;
  readonly scopeRanges: ScopeRange[] = [];
  /**
   * List of all symbol references in this file,
   * in order of appearance.
   */
  protected _refs: ProjectSymbol[] = [];

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

  async parse(path: Pathy<string>) {
    this._content = await path.read();
    this._parsed = parser.parse(this.content);
  }

  addRef(ref: ProjectSymbol) {
    this._refs.push(ref);
  }

  clearRefs() {
    this._refs = [];
  }

  updateGlobals() {
    this.clearRefs();
    return processGlobalSymbols(this);
  }

  updateAllSymbols() {
    this.clearRefs();
    return processSymbols(this);
  }
}
