import * as t from './project.abstract.js';
import { Type } from './types.type.js';

export class Reference {
  readonly $tag = 'Ref';
  type: Type = new Type('Unknown');
  start: t.Position;
  end: t.Position;
  constructor(readonly symbol: t.Symbol, readonly location: t.Range) {
    this.start = location.start;
    this.end = location.end;
  }
}
