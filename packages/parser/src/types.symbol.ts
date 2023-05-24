import { Flaggable } from './types.flags.js';
import { Range, Reference } from './types.location.js';
import { Type } from './types.type.js';

export class Symbol extends Flaggable {
  readonly $tag = 'Sym';
  refs: Reference[] = [];
  description: string | undefined = undefined;
  range: Range | undefined = undefined;
  type: Type = new Type('Unknown');

  constructor(readonly name: string) {
    super();
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

  addRef(location: Range, type: Type): void {
    throw new Error('Method not implemented.');
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
