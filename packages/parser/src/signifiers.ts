import { Range, Reference } from './project.location.js';
import { getTypes } from './types.checks.js';
import { Flags } from './types.flags.js';
import { Type, TypeStore } from './types.js';
import { PrimitiveName } from './types.primitives.js';
import { assert } from './util.js';

export class Signifier extends Flags {
  readonly $tag = 'Sym';
  description: string | undefined = undefined;
  type: TypeStore = new TypeStore();
  /** For function params, the index of this param */
  idx: number | undefined = undefined;
  /** The Type containing this member */
  readonly parent: Type;
  /**
   * If this is a native entity (built into GameMaker),
   * this is set to the name of the module it came from.
   */
  protected _native?: string = undefined;
  /**
   * If `true`, then this definitely exists but may not have a place where it
   * is declared. E.g. the `global` variable. In that case this would be set to
   * `true`. Otherwise `undefined` is interpreted to mean that this thing
   * does not have a definite declaration.
   */
  protected _def: Range | { file?: undefined } | undefined = undefined;
  refs = new Set<Reference>();

  constructor(parent: Type, readonly name: string, type?: Type | Type[]) {
    super();
    if (type) {
      this.setType(type);
    }
    this.parent = parent;
  }

  addRef(location: Range, isDef = false): Reference {
    const ref = Reference.fromRange(location, this as any);
    ref.isDef = isDef;
    this.refs.add(ref);
    location.file.addRef(ref);
    return ref;
  }

  get def() {
    return this._def;
  }
  set def(location: Range | { file?: undefined } | undefined) {
    assert(
      !this.native,
      'Cannot change declaration location on a native entity',
    );
    this._def = location;
  }

  definedAt(location: Range | undefined): this {
    this.def = location;
    return this;
  }

  get native() {
    return this._native;
  }
  set native(nativeModule: string | undefined) {
    this._native = nativeModule;
    if (nativeModule) {
      this._def = {};
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

  setType(newType: Type | TypeStore | (TypeStore | Type)[]): this {
    this.type.type = getTypes(newType);
    if (newType instanceof Type) {
      newType.signifier = this;
    }
    return this;
  }

  /** @deprecated Types should be set in one go instead of added piecemeal */
  addType(newType: Type | Type[]): this {
    // We may have duplicate types, but that information is
    // still useful since the same type information may have
    // come from multiple assignment statements.
    this.type.addType(newType);
    return this;
  }

  get isTyped(): boolean {
    return this.type.type.length > 0;
  }

  getTypeByKind<T extends PrimitiveName>(kind: T): Type<T> | undefined {
    return this.type.type.find((t) => t.kind === kind) as Type<T> | undefined;
  }
}
