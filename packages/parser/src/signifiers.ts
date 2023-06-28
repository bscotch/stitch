import { Flaggable } from './types.flags.js';
import { StructType, Type } from './types.js';

export class Signifier extends Flaggable {
  readonly $tag = 'Sym';
  description: string | undefined = undefined;
  type: Type = new Type('Unknown');
  /** For function params, the parameter index */
  idx: number | undefined = undefined;

  constructor(
    /** The global, self, or local struct containing this signifier */
    readonly container: StructType,
    readonly name: string,
    type?: Type,
  ) {
    super();
    if (type) {
      this.type = type;
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
    if (this.type.kind === 'Unknown') {
      // Change the type to a this new type
      this.type = newType;
    } else if (this.type.kind !== 'Union') {
      // Then we need to convert it into a union type
      const originalType = this.type;
      this.type = new Type('Union')
        .addUnionType(originalType)
        .addUnionType(newType);
    }
    return this;
  }
}
