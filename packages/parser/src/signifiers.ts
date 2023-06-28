import { arrayWrapped } from '@bscotch/utility';
import { Range, Reference } from './project.location.js';
import { Flaggable } from './types.flags.js';
import { StructType, Type } from './types.js';

export interface SignifierConfig {
  description?: string;
  idx?: number;
  /** The associated type is added at the time of identifying the signifier, or its first assignment  */
  type: Type[];
}

export class Signifier extends Flaggable {
  readonly $tag = 'Sym';
  protected readonly config: SignifierConfig = { type: [] };
  /**
   * If `true`, then this definitely exists but may not have a place where it
   * is declared. E.g. the `global` variable. In that case this would be set to
   * `true`. Otherwise `undefined` is interpreted to mean that this thing
   * does not have a definite declaration.
   */
  def: Range | { file?: undefined } | undefined = undefined;
  refs = new Set<Reference>();

  constructor(
    /** The global, self, or local struct containing this signifier */
    readonly container: StructType,
    readonly name: string,
    type?: Type | Type[],
  ) {
    super();
    for (const subtype of arrayWrapped(type)) {
      this.addType(subtype);
    }
  }

  get type(): readonly Type[] {
    return [...this.config.type];
  }
  get idx(): number | undefined {
    return this.config.idx;
  }
  set idx(idx: number | undefined) {
    this.config.idx = idx;
  }

  describe(description: string | undefined): this {
    this.config.description = description;
    return this;
  }

  addType(newType: Type | Type[]): this {
    for (const type of arrayWrapped(newType)) {
      this.config.type.push(type);
      type.addRef(this);
    }
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
}
