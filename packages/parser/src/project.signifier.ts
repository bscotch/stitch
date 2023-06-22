import { Refs } from './project.location.js';
import { Flaggable } from './types.flags.js';
import { Type } from './types.js';

export class Signifier extends Refs(Flaggable) {
  readonly $tag = 'Sym';
  description: string | undefined = undefined;
  type: Type = new Type('Unknown');

  constructor(readonly name: string, type?: Type) {
    super();
    if (type) {
      this.type = type;
    }
  }

  toJSON() {
    return {
      $tag: this.$tag,
      name: this.name,
      type: this.type,
    };
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
