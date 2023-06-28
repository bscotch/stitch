import { arrayWrapped } from '@bscotch/utility';
import { Flaggable } from './types.flags.js';
import { StructType, Type } from './types.js';

export class Signifier extends Flaggable {
  readonly $tag = 'Sym';
  description: string | undefined = undefined;
  type: Type[] = [];
  /** For function params, the parameter index */
  idx: number | undefined = undefined;

  constructor(
    /** The global, self, or local struct containing this signifier */
    readonly container: StructType,
    readonly name: string,
    type?: Type | Type[],
  ) {
    super();
    if (type) {
      this.type = arrayWrapped(type);
    }
  }

  describe(description: string | undefined): this {
    this.description = description;
    return this;
  }

  addType(newType: Type): this {
    // We may have duplicate types, but that information is
    // still useful since the same type information may have
    // come from multiple assignment statements.
    this.type = [...this.type, newType];
    return this;
  }
}
