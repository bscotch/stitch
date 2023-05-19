import type { YyResourceType } from '@bscotch/yy';

interface Project extends Base {
  $type: 'project';
  resources: Resource[];
  global: StructType;
}

interface Resource<T extends YyResourceType = YyResourceType> extends Base {
  $type: 'resource';
  kind: T;
  /** Objects and scripts have associated GML files. */
  gmlFiles: GmlFile[];
  /** All resources are represented as global symbols. */
  symbol: Symbol;
}

interface GmlFile<T extends GmlFileKind = GmlFileKind> extends Base {
  $type: 'gmlFile';
  kind: T;
  scopeRanges: ScopeRange[];
}

interface ScopeRange extends Range {
  kind: 'scope';
  local: StructType;
  self: StructType;
}

interface Symbol extends Base {
  $type: 'symbol';
  /**
   * Identifier that, in combination with the scope, uniquely
   * identifies this symbol. */
  name: string;
  /** The parent struct containing this symbol */
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
  type: Type[];

  /** All references to this symbol */
  refs: Reference[];
}

interface Reference extends Base {
  $type: 'ref';
  symbol: Symbol;
  /** The subset of types the symbol could have at this reference. */
  type: Type[];
}

//#region TYPES

/**
 * Type kinds are determined by the official GmlSpec.xml specs.
 * As a consequence, this listing might be incomplete!
 */
type PrimitiveTypeKind =
  | 'Array'
  | 'Struct'
  | 'String'
  | 'Real'
  | 'Bool'
  | 'Function'
  | 'Pointer'
  | 'Undefined';

type Type =
  | ArrayType
  | StructType
  | FunctionType
  | TypeBase<'String' | 'Real' | 'Bool' | 'Pointer' | 'Undefined'>;

interface FunctionType extends TypeBase<'Function'> {
  kind: 'Function';
  context: StructType;
  /** The parameters this function takes. */
  params: {
    name: string;
    type: Type[];
    optional: boolean;
  }[];
  /** The type of value that this function returns. */
  returns: Type[];
}

interface StructType extends TypeBase<'Struct'> {
  members: { [property: string]: Type[] };
  /** The type that this struct extends, if any. */
  extends: Type | null;
}

interface ArrayType extends TypeBase<'Array'> {
  /** The types that members of this array can be. */
  members: Type[];
}

interface TypeBase<T extends PrimitiveTypeKind> extends Base {
  $type: 'type';
  kind: T;
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
  name?: string;
}

//#endregion TYPES

//#region BASE TYPES
interface Range extends Base {
  $type: 'location';
  start: Position;
  end: Position;
}

interface Position extends Base {
  $type: 'position';
  file: string;
  offset: number;
  line: number;
  column: number;
}

type ScopeKind = 'local' | 'self';
type GmlFileKind = 'objects' | 'scripts';

interface Base {
  /**
   * A string representing the shape of this object,
   * intended to make it easy to kind-guard. Often based
   * on the interface or class name implementing the interface.
   */
  $type: string;
  /**
   * A string representing the specific kind of this object,
   * where the general shape matches the type but some details
   * may be added or made more specific.
   */
  kind?: string;
}
//#endregion BASE TYPES
