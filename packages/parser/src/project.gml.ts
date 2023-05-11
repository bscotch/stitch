import { Pathy } from '@bscotch/pathy';
import type { GameMakerResource } from './project.resource.js';
import { LocalScope, ScopeRange } from './symbols.scopes.js';
import { ProjectSymbol } from './symbols.symbol.js';
import { processSymbols } from './symbols.visitor.js';

export class GmlFile {
  readonly kind = 'gml';
  protected _content!: string;
  readonly scopeRanges: ScopeRange[] = [];
  /**
   * List of all symbol references in this file,
   * in order of appearance.
   */
  readonly refs: ProjectSymbol[] = [];

  constructor(
    readonly resource: GameMakerResource<'objects' | 'scripts'>,
    readonly path: Pathy<string>,
  ) {
    this.scopeRanges.push(
      new ScopeRange(this.self, new LocalScope(this), this),
    );
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

  async load(path: Pathy<string>) {
    this._content = await path.read();
  }

  parse() {
    return processSymbols(this);
  }
}
