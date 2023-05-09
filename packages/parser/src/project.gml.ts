import { Pathy } from '@bscotch/pathy';
import { parser } from './parser.js';
import type { GameMakerResource } from './project.resource.js';
import { gmlSymbolVisitor } from './symbols.visitor.js';

export class GmlFile {
  readonly kind = 'gmlFile';
  protected _content!: string;

  constructor(
    readonly resource: GameMakerResource,
    readonly path: Pathy<string>,
  ) {}

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
    const results = parser.parse(this._content);
    // TODO: Emit diagnostics
    const symbols = gmlSymbolVisitor.findSymbols(results.cst);
    // TODO: Update symbol/scope info somehow
  }
}
