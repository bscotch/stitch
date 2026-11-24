/**
 * The type model: Feather-compatible types as immutable values.
 *
 * A type is a `kind` (e.g. `Real`, `Struct`, `Id.Instance`), optionally
 * narrowed by a `name` (`Struct.Foo`, `Id.Instance.o_player`) and/or
 * parameterized by `items` (`Array<Real>`). A union is a list of types.
 *
 * Types never hold members or signatures. Those belong to *entities*
 * (struct shapes, functions, enums) in the symbol table:
 * - Named types (`Struct.Foo`) are looked up by name when needed, so a type
 *   value never goes stale when the declaration it names changes.
 * - Anonymous types (a struct literal, a function expression) carry the
 *   id of their entity in `entity`.
 */
import { formatDocType, type DocType } from '@bscotch/gml-syntax';

/** Base types, plus the extra kinds Stitch uses */
export const primitiveKinds = [
  'Any',
  'Array',
  'Asset',
  'Id',
  'ArgumentIdentity',
  'Bool',
  'Enum',
  'EnumMember',
  'Function',
  'Mixed',
  'Never',
  'Pointer',
  'Real',
  'String',
  'Struct',
  'Undefined',
  'Unknown',
  'Asset.GMAnimCurve',
  'Asset.GMAudioGroup',
  'Asset.GMFont',
  'Asset.GMObject',
  'Asset.GMParticleSystem',
  'Asset.GMPath',
  'Asset.GMRoom',
  'Asset.GMScript',
  'Asset.GMSequence',
  'Asset.GMShader',
  'Asset.GMSound',
  'Asset.GMSprite',
  'Asset.GMTileSet',
  'Asset.GMTimeline',
  'Asset.Script',
  'Id.AudioEmitter',
  'Id.AudioListener',
  'Id.AudioSyncGroup',
  'Id.BackgroundElement',
  'Id.BinaryFile',
  'Id.Buffer',
  'Id.Camera',
  'Id.DsGrid',
  'Id.DsList',
  'Id.DsMap',
  'Id.DsPriority',
  'Id.DsQueue',
  'Id.DsStack',
  'Id.ExternalCall',
  'Id.Gif',
  'Id.Instance',
  'Id.Layer',
  'Id.MpGrid',
  'Id.ParticleEmitter',
  'Id.ParticleSystem',
  'Id.ParticleType',
  'Id.PhysicsIndex',
  'Id.PhysicsParticleGroup',
  'Id.Sampler',
  'Id.SequenceElement',
  'Id.Socket',
  'Id.Sound',
  'Id.SpriteElement',
  'Id.Surface',
  'Id.TextFile',
  'Id.Texture',
  'Id.TileElementId',
  'Id.TileMapElement',
  'Id.TimeSource',
  'Id.Uniform',
  'Id.VertexBuffer',
  'Id.VertexFormat',
  // Utility types, resolved away when inferring
  'InstanceType',
  'ObjectType',
  'StaticType',
] as const;
export type PrimitiveKind = (typeof primitiveKinds)[number];

const kindsByLowerName = new Map<string, PrimitiveKind>(
  primitiveKinds.map((k) => [k.toLowerCase(), k]),
);
/** Kinds whose values can be used as `self` (with `with`, or dot-access) */
export const withableKinds = new Set<string>([
  'Struct',
  'Id.Instance',
  'Asset.GMObject',
]);

export interface Type {
  readonly kind: string;
  /** The specifier, e.g. `Foo` in `Struct.Foo`. For enum members: `Enum.Member`. */
  readonly name?: string;
  /** Item types, e.g. `Real` in `Array<Real>` */
  readonly items?: readonly Type[];
  /** For anonymous structs and functions, the entity defining their members/signature */
  readonly entity?: string;
  /** For template parameters: this stands for whatever the template resolves to */
  readonly generic?: boolean;
  /** For native constant classes (`Constant.Foo`), the class name is in `name` */
  readonly constant?: boolean;
  /** For string literal types (`"left"`), the literal as written */
  readonly literal?: string;
}

/** A union of types. An empty union means "nothing known" (shown as `Any`). */
export type TypeUnion = readonly Type[];

export const T = {
  any: { kind: 'Any' } as Type,
  unknown: { kind: 'Unknown' } as Type,
  real: { kind: 'Real' } as Type,
  string: { kind: 'String' } as Type,
  bool: { kind: 'Bool' } as Type,
  undefined: { kind: 'Undefined' } as Type,
  pointer: { kind: 'Pointer' } as Type,
  never: { kind: 'Never' } as Type,
  struct: { kind: 'Struct' } as Type,
  function: { kind: 'Function' } as Type,
  array: { kind: 'Array' } as Type,
  instance: { kind: 'Id.Instance' } as Type,
};

/** Normalize a kind's casing (`real` → `Real`), or `undefined` if not a known kind */
export function normalizeKind(name: string): PrimitiveKind | undefined {
  return kindsByLowerName.get(name.toLowerCase());
}

export function typeOf(
  kind: string,
  extra?: Omit<Partial<Type>, 'kind'>,
): Type {
  return { kind, ...extra };
}

/** Format a type in Feather syntax, e.g. `Array<Struct.Foo>` */
export function formatType(type: Type): string {
  if (type.generic && type.name) return type.name;
  if (type.literal) return type.literal;
  if (type.kind === 'EnumMember' && type.name) return `Enum.${type.name}`;
  if (type.constant && type.name) return `Constant.${type.name}`;
  if (type.name) return `${type.kind}.${type.name}`;
  if (type.items?.length) {
    return `${type.kind}<${formatUnion(type.items)}>`;
  }
  return type.kind;
}

/** Format a union in Feather syntax. Members are deduplicated and sorted. */
export function formatUnion(union: TypeUnion): string {
  const parts = [...new Set(union.map(formatType))].sort((a, b) =>
    a.localeCompare(b),
  );
  return parts.join('|') || 'Any';
}

/** Structural equality */
export function sameType(a: Type, b: Type): boolean {
  return formatType(a) === formatType(b) && a.entity === b.entity;
}

/** Combine unions, removing duplicates */
export function union(...unions: (TypeUnion | Type | undefined)[]): Type[] {
  const result: Type[] = [];
  for (const u of unions) {
    if (!u) continue;
    for (const t of 'kind' in u ? [u as Type] : (u as TypeUnion)) {
      if (!result.some((r) => sameType(r, t))) result.push(t);
    }
  }
  return result;
}

/** The types in a union that have one of the given kinds */
export function ofKind(
  types: TypeUnion | undefined,
  ...kinds: string[]
): Type[] {
  return (types || []).filter((t) => kinds.includes(t.kind));
}

/** `true` if the union has no information (empty, or only Any/Unknown/Mixed) */
export function isUntyped(types: TypeUnion | undefined): boolean {
  return (
    !types?.length ||
    types.every((t) => ['Any', 'Unknown', 'Mixed'].includes(t.kind))
  );
}

//#region Types from docs

/** Resolves a dotted type name (`Struct.Foo`) to a type, if known */
export type TypeNameResolver = (name: string) => Type | undefined;

export interface DocTypeContext {
  resolve?: TypeNameResolver;
  /** Template parameters in scope, by name */
  generics?: ReadonlyMap<string, Type>;
  /** Called for names that can't be resolved */
  onUnknown?: (name: string, span: { start: number; end: number }) => void;
}

/**
 * Convert a parsed doc type (from `@param {Type}` etc.) into a type union.
 */
export function typeFromDoc(doc: DocType, ctx: DocTypeContext = {}): Type[] {
  if (doc.kind === 'union') {
    return union(...doc.types.map((t) => typeFromDoc(t, ctx)));
  }
  if (doc.kind === 'literal') {
    return [{ kind: 'String', literal: doc.raw }];
  }
  const items = doc.args.length
    ? union(...doc.args.map((a) => typeFromDoc(a, ctx)))
    : undefined;
  const base = typeFromName(doc.name, ctx);
  if (!base) {
    ctx.onUnknown?.(doc.name, doc);
    return [{ kind: 'Unknown', name: doc.name }];
  }
  return [items ? { ...base, items } : base];
}

/**
 * Convert a type string (e.g. from a spec) into a union, using the doc-type
 * parser. Unparseable strings become `Any`.
 */
export function typeFromString(
  text: string,
  parse: (text: string) => DocType | null,
  ctx: DocTypeContext = {},
): Type[] {
  const doc = parse(text);
  return doc ? typeFromDoc(doc, ctx) : [T.any];
}

/** Resolve a single (possibly dotted) type name */
export function typeFromName(
  name: string,
  ctx: DocTypeContext,
): Type | undefined {
  const generic = ctx.generics?.get(name);
  if (generic) return generic;
  const resolved = ctx.resolve?.(name);
  if (resolved) return resolved;
  const kind = normalizeKind(name);
  if (kind) return { kind };
  // Dotted names: a known base kind with a specifier, e.g. `Struct.Foo`
  // or `Id.Instance.o_player`. Try the longest known prefix.
  const parts = name.split('.');
  for (let i = parts.length - 1; i > 0; i--) {
    const prefix = parts.slice(0, i).join('.');
    const rest = parts.slice(i).join('.');
    if (prefix.toLowerCase() === 'constant') {
      return { kind: 'Any', name: rest, constant: true };
    }
    if (prefix.toLowerCase() === 'enum' && parts.length === 3) {
      return { kind: 'EnumMember', name: rest };
    }
    const baseKind = normalizeKind(prefix);
    if (baseKind) return { kind: baseKind, name: rest };
  }
  return undefined;
}

export { formatDocType };
//#endregion
