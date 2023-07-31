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

  /**
   * Create a new Signifier instance with the same properties as this one,
   * except for its refs. Note that it is a shallow copy!
   */
  copy(): this {
    const copy = new Signifier(this.parent, this.name);
    copy.description = this.description;
    copy.type = this.type;
    copy.idx = this.idx;
    copy._native = this._native;
    copy._def = this._def;
    copy.flags = this.flags;
    return copy as this;
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
    // If we have set a declaration location for this variable,
    // and there exists a child of the struct-like holding onto
    // this variable, then we should replace any child's *undefined*
    // variable with this one.
    if (location?.file && this.parent) {
      for (const child of this.parent.listChildren(true)) {
        const existingMember = child.getMember(this.name, true);
        if (existingMember && !existingMember.def) {
          // Then that member is likely intended to be a reference to
          // this one, so we should replace it.
          child.replaceMember(this);
        }
      }
    }
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
