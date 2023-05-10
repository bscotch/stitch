import { Pathy } from '@bscotch/pathy';
import type { GameMakerResource } from './project.resource.js';
import type { LocalScope, SelfScope } from './symbols.scopes.js';
import { processSymbols } from './symbols.visitor.js';

export class GmlFile {
  readonly kind = 'gmlFile';
  protected _content!: string;
  readonly localScopes: LocalScope[] = [];
  readonly selfScopes: SelfScope[] = [];

  constructor(
    readonly resource: GameMakerResource<'objects' | 'scripts'>,
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
    return processSymbols(this);
  }
}
