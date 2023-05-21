import type { YyResourceType } from '@bscotch/yy';

/** Identifiers for the various main parts making up the model of a project. */
export const enum TagKind {
  Project,
  Resource,
  GmlFile,
  Position,
  Range,
  Scope,
  Symbol,
  Reference,
  Type,
  ArrayType,
  StructType,
  FunctionType,
  TypeUnion,
}

interface Project extends Base {
  $tag: TagKind.Project;
  resources: Resource[];
  /**
   * The variables available via `global.<name>`, defined
   * via `globalvar`, dotting into `global`, or implicitly
   * (e.g. functions defined in scripts).
   */
  globals: StructType;
  enums: StructType;
  /**
   * The native GML functions and other globals.
   */
  gml: StructType;
}

interface Resource<T extends YyResourceType = YyResourceType> extends Base {
  $tag: TagKind.Resource;
  kind: T;
  /** Objects and scripts have associated GML files. */
  gmlFiles: GmlFile[];
  /** All resources are represented as global symbols. */
  symbol: Symbol;
}

const enum GmlFileKind {
  Script,
  Object,
}

interface GmlFile<T extends GmlFileKind = GmlFileKind> extends Base {
  $tag: TagKind.GmlFile;
  kind: T;
  scopeRanges: Scope[];
}

interface Scope extends Omit<Range, '$tag'> {
  $tag: TagKind.Scope;
  local: StructType;
  self: StructType;
}

export const enum SymbolFlag {
  Readable = 1 << 0,
  Writable = 1 << 1,
  Instance = 1 << 2,
  Deprecated = 1 << 3,
  ReadWrite = Readable | Writable,
}

export interface Symbol extends Base {
  $tag: TagKind.Symbol;
  /**
   * Identifier that, in combination with the scope, uniquely
   * identifies this symbol. */
  name: string;
  description: string | null;
  flags: SymbolFlag;

  /**
   * The parent struct/scope where this symbol's identifier
   * refers to it. */
  parent: StructType;
  /**
   * Where this symbol was defined, if it is a project symbol
   * (as opposed to a native GML symbol) */
  range: Range | null;
  /**
   * The possible types that this symbol can have. If this symbol
   * is a constant, then this is also the only type it can have.
   * If not, then this represents the cumulative types of all refs
   * for this symbol. */
  type: TypeUnion;

  /** All references to this symbol */
  refs: Reference[];
  addRef(location: Range, type: TypeUnion): void;
}

export interface Reference extends Omit<Range, '$tag'> {
  $tag: TagKind.Reference;
  symbol: Symbol;
  /** The subset of types the symbol could have at this reference. */
  type: TypeUnion;
}

//#region TYPES

/**
 * Type kinds are determined by the official GmlSpec.xml specs.
 * As a consequence, this listing might be incomplete!
 */
export const enum PrimitiveKind {
  Any,
  Array,
  Bool,
  Enum,
  Function,
  Pointer,
  Real,
  String,
  Struct,
  Undefined,
}

export interface TypeUnion extends Base {
  $tag: TagKind.TypeUnion;
  mutable: boolean;
  add(type: Type): this;
  get types(): Type[];
}

export type Type =
  | AnyType
  | ArrayType
  | StructType
  | FunctionType
  | EnumType
  | StringType
  | RealType
  | BoolType
  | PointerType
  | UndefinedType;

export interface AnyType extends TypeBase<PrimitiveKind.Any> {}
export interface StringType extends TypeBase<PrimitiveKind.String> {}
export interface RealType extends TypeBase<PrimitiveKind.Real> {}
export interface BoolType extends TypeBase<PrimitiveKind.Bool> {}
export interface PointerType extends TypeBase<PrimitiveKind.Pointer> {}
export interface UndefinedType extends TypeBase<PrimitiveKind.Undefined> {}

export interface FunctionType extends TypeBase<PrimitiveKind.Function> {
  context: StructType;
  /** The parameters this function takes. */
  params: {
    name: string;
    type: TypeUnion;
    optional: boolean;
  }[];
  /** The type of value that this function returns. */
  returns: TypeUnion;
}

export interface EnumType extends TypeBase<PrimitiveKind.Enum> {
  members: { [name: string]: RealType };
}

export interface StructType extends TypeBase<PrimitiveKind.Struct> {
  members: { [name: string]: TypeUnion };
  /** The type that this struct extends, if any. */
  parent: StructType | null;
}

export interface ArrayType extends TypeBase<PrimitiveKind.Array> {
  /** The types that members of this array can be. */
  members: TypeUnion;
}

export interface TypeBase<T extends PrimitiveKind = PrimitiveKind>
  extends Base {
  $tag: TagKind.Type;
  kind: T;
  parent: Type | null;
  /**
   * Non-native types are defined at a reference to a symbol,
   * e.g. a constructor, struct literal, asset, or object create event.
   * When that definition is edited the typed will need to be updated.
   *
   * They can also be defined by a JSDoc comment (TODO: deal with that...)
   */
  def: Reference | null;
  refs: Reference[];

  /**
   * Some types can have a name. For example, a globally
   * defined constructor MyConstructor will produce structs
   * of type name `Struct.MyConstructor`. Type names can be
   * used in JSDocs.
   */
  name: string | null;
}

//#endregion TYPES

//#region BASE TYPES
export interface Range extends Base {
  $tag: TagKind.Range;
  start: Position;
  end: Position;
}

export interface Position extends Base {
  $tag: TagKind.Position;
  file: string;
  offset: number;
  line: number;
  column: number;
}

interface Base {
  /**
   * A category representing the shape of this object,
   * intended to make it easy to kind-guard. Often based
   * on the interface or class name implementing the interface.
   */
  $tag: TagKind;
}
//#endregion BASE TYPES
