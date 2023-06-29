import { arrayWrapped } from '@bscotch/utility';
import { Range, Reference } from './project.location.js';
import { Flaggable } from './signifiers.flags.js';
import { AssignableType, FunctionType, StructType, Type } from './types.js';

export interface SignifierConfig {
  description?: string;
  idx?: number;
  /** The associated type is added at the time of identifying the signifier, or its first assignment  */
  type: AssignableType;
}

export class Signifier extends Flaggable {
  readonly $tag = 'Signifier';
  protected readonly config: SignifierConfig = {
    type: new AssignableType(),
  };
  /**
   * If `true`, then this definitely exists but may not have a place where it
   * is declared. E.g. the `global` variable. In that case this would be set to
   * `true`. Otherwise `undefined` is interpreted to mean that this thing
   * does not have a definite declaration.
   */
  def: Range | { file?: undefined } | undefined = undefined;
  refs = new Set<Reference>();

  constructor(
    /** The global, self, or local struct containing this signifier, or the function if it is a parameter. */
    readonly container: StructType | FunctionType,
    readonly name: string,
    type?: Type | Type[],
  ) {
    super();
    for (const subtype of arrayWrapped(type)) {
      this.setType(subtype);
    }
  }

  get type(): AssignableType {
    return this.config.type;
  }
  get idx(): number | undefined {
    return this.config.idx;
  }
  set idx(idx: number | undefined) {
    this.config.idx = idx;
  }
  get description(): string | undefined {
    return this.config.description;
  }

  describe(description: string | undefined): this {
    this.config.description = description;
    return this;
  }

  setType(newType: Type | Type[]): this {
    this.config.type.setTypes(newType);
    return this;
  }

  addRef(location: Range): Reference {
    const ref = Reference.fromRange(location, this as any);
    this.refs.add(ref);
    location.file.addRef(ref);
    return ref;
  }

  definedAt(location: Range | undefined): this {
    this.def = location;
    return this;
  }

  /**
   * Mark this signifier as deleted, which should cause any references
   * to it to become invalid and any associated types to be invalid as well.
   */
  delete() {
    // Inform referrers
    for (const ref of this.refs) {
      ref.file.dirty = true;
    }
    // Inform type-referrers
    this.type.delete();
  }
}
