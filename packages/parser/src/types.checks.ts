import { arrayWrapped, isArray } from '@bscotch/utility';
import type { Signifier } from './signifiers.js';
import { KnownTypesMap } from './types.feather.js';
import { Type, TypeStore } from './types.js';
import { PrimitiveName } from './types.primitives.js';

export function isTypeOfKind<T extends PrimitiveName>(
  item: any,
  kind: T,
): item is Type<T> {
  return isTypeInstance(item) && item.kind === kind;
}

export function isTypeStoreOfKind<T extends PrimitiveName>(
  item: any,
  kind: T,
): item is TypeStore<T> {
  return isTypeStore(item) && item.kind === kind;
}

export function isTypeOrStoreOfKind<T extends PrimitiveName>(
  item: any,
  kind: T,
): item is Type<T> | TypeStore<T> {
  return isTypeOfKind(item, kind) || isTypeStoreOfKind(item, kind);
}

/**
 * Given some kind of type collection, find the first one matching
 * a given kind.
 */
export function getTypeOfKind<T extends PrimitiveName>(
  from: undefined | Signifier | Type | TypeStore | (Type | TypeStore)[],
  kind: T | ReadonlyArray<T>,
): { [Kind in T]: Type<Kind> }[T] | undefined {
  if (!from) return undefined;
  const types = getTypes(from);
  const kinds = arrayWrapped(kind) as T[];
  return types.find((t) => kinds.includes(t.kind as any)) as
    | Type<T>
    | undefined;
}

export function getTypesOfKind<T extends PrimitiveName>(
  from: undefined | Signifier | Type | TypeStore | (Type | TypeStore)[],
  kind: T | ReadonlyArray<T>,
): { [Kind in T]: Type<Kind> }[T][] {
  if (!from) return [];
  const types = getTypes(from);
  const kinds = arrayWrapped(kind) as T[];
  return types.filter((t) => kinds.includes(t.kind as any)) as any;
}

/** Get the typestore of item, if present. Else get the type on item. */
export function getTypeStoreOrType(
  item: Signifier | Type | TypeStore | Type[],
): TypeStore | Type[] {
  if (isArray(item)) {
    return item;
  }
  if (item.$tag === 'Sym') {
    return item.type;
  } else if (item.$tag === 'TypeStore') {
    return item;
  }
  return arrayWrapped(item);
}

/** Things that can be converted into an array of types */
export type Typeable = Signifier | Type | TypeStore | (Type | TypeStore)[];

export function getTypes(items: Typeable | undefined): Type[] {
  const types: Type[] = [];
  if (!items) {
    return types;
  }
  for (const item of arrayWrapped(items)) {
    if (item.$tag === 'Sym') {
      types.push(...item.type.type);
    } else if (item.$tag === 'TypeStore') {
      return [...item.type];
    } else {
      types.push(item);
    }
  }
  return types;
}

export function isTypeInstance(item: any): item is Type {
  return item && '$tag' in item && item.$tag === 'Type';
}

export function isTypeStore(item: any): item is TypeStore {
  return item && '$tag' in item && item.$tag === 'TypeStore';
}

/**
 * Returns `true` if `narrowed` is a subtype of `type`,
 * meaning that it is a subset/narrowed/compatible/same type
 * compared to otherType.
 *
 * Identical types also return `true`.
 */
export function narrows(
  narrowType: Type | TypeStore | Type[],
  broadType: Type | TypeStore | Type[],
): boolean {
  // Convert to type arrays
  const narrowTypes = getTypes(narrowType);
  const broadTypes = getTypes(broadType);
  // All "narrow" types must be a subtype of at least one "broad" type
  return narrowTypes.every((narrow) =>
    broadTypes.some((broad) => narrowsType(narrow, broad)),
  );
}

/**
 * Returns `true` if `narrowed` is a subtype of `type`,
 * meaning that it is a subset/narrowed/compatible/same type
 * compared to otherType.
 *
 * Identical types also return `true`.
 */
function narrowsType(narrowType: Type, broadType: Type): boolean {
  if (narrowType === broadType) {
    return true;
  }

  if (
    ['Mixed', 'Any', 'Unknown'].includes(broadType.kind) ||
    ['Mixed', 'Any'].includes(narrowType.kind)
  ) {
    // Then everyone is satisfied all of the time
    return true;
  }

  if (broadType.kind !== narrowType.kind) {
    return false;
  }

  // The subtype must have all of the same members, though it could also have others
  for (const member of broadType.listMembers()) {
    const matching = narrowType.getMember(member.name);
    if (!matching) {
      return false;
    }
  }
  // Similarly, the subtype must have the same params (though it could have others)
  for (const param of broadType.listParameters()) {
    const matching = narrowType.getParameter(param.idx!);
    if (!matching) {
      return false;
    }
  }
  // Check return type
  if (
    broadType.returns &&
    (!narrowType.returns || !narrows(narrowType.returns, broadType.returns))
  ) {
    return false;
  }
  // Check the constructs type
  if (
    broadType.isConstructor &&
    (!narrowType.isConstructor || !narrows(narrowType.self!, broadType.self!))
  ) {
    return false;
  }

  return true;
}

/**
 * For types inferred from expressions, normalize away utility
 * types like `InstanceType` and `ObjectType`, and perform any
 * other type-normalization tasks. Returns a new TypeStore, so
 * if maintaining reference links is essential this function should
 * not be used.
 */
export function normalizeType(
  inferred: Typeable,
  knownTypes: KnownTypesMap,
): TypeStore {
  const normalized = new TypeStore();
  type: for (const type of getTypes(inferred)) {
    if (type.kind === 'EnumMember') {
      normalized.addType(type.signifier?.parent || type);
      continue;
    } else {
      for (const [utilityKind, kind] of [
        ['InstanceType', 'Id.Instance'],
        ['ObjectType', 'Asset.GMObject'],
      ] as const) {
        if (type.kind !== utilityKind) continue;
        if (!type.items?.type.length) {
          normalized.addType(knownTypes.get(kind) || new Type(kind));
        }
        for (const itemType of getTypes(type.items || [])) {
          // Try to convert the type.
          const name = itemType.name ? `${kind}.${itemType.name}` : kind;
          let type =
            knownTypes.get(name) || knownTypes.get(kind) || new Type(kind);
          if (itemType.isGeneric) {
            // Then extend the type to allow having a generic without mutating the original
            type = type.derive().genericize().named(itemType.name);
          }
          normalized.addType(type);
        }
        continue type; // so that the fall-through only happens if we didn't find a match
      }
    }
    normalized.addType(type);
  }
  return normalized;
}

/**
 * Given an expected type that might include generics, and an inferred
 * type that should map onto it, update a generics map linking generics
 * to inferred types by name.
 */
export function updateGenericsMap(
  expected: Typeable,
  inferred: Typeable,
  knownTypes: KnownTypesMap,
  /** Map of generics by name to their *inferred type* */
  generics: Map<string, TypeStore> = new Map(),
) {
  const expectedTypes = getTypes(expected)
    .map((t) => normalizeType(t, knownTypes).type)
    .flat();
  const inferredTypes = getTypes(inferred)
    .map((t) => normalizeType(t, knownTypes).type)
    .flat();

  // The collection of 1 or more expected types is supposed
  // to match up with the collection of 1 or more inferred types.
  // For the overlap of compatible types we need to recurse through
  // the types and their contained types (stored on the `items` property)
  // to identify any generics specified in the expected types that we
  // can resolve with the inferred types.
  for (const expectedType of expectedTypes) {
    let generic: TypeStore | undefined;
    if (expectedType.isGeneric) {
      const genericName = expectedType.name!;
      generic = generics.get(genericName) || new TypeStore();
      generics.set(genericName, generic);
    }
    for (const inferredType of inferredTypes) {
      if (narrowsType(inferredType, expectedType)) {
        if (generic) {
          // Then we can use this inferred type to resolve the generic
          generic.addType(inferredType);
        }
        // Repeat on contained types, if there are any
        if (inferredType.items?.hasTypes && expectedType.items?.hasTypes) {
          updateGenericsMap(
            expectedType.items,
            inferredType.items,
            knownTypes,
            generics,
          );
        }
      }
    }
  }

  return generics;
}

export function replaceGenerics(
  startingType: Typeable,
  knownTypes: KnownTypesMap,
  generics: Map<string, TypeStore>,
): TypeStore {
  const startingTypes = getTypes(startingType);
  // Recurse through the types and, if we find a generic, replace it!
  // The complication is that we don't want to mutate the starting types, we need to replace them (or their containers!) with a new type. The easiest way to do this is to just create new types from the jump.
  const replacedTypes = new TypeStore();
  for (const startingType of startingTypes) {
    const newTypes =
      startingType.isGeneric && generics.has(startingType.name!)
        ? generics.get(startingType.name!)?.type
        : [startingType];
    for (const type of newTypes || []) {
      const newType = type.derive();
      if (type.items) {
        newType.items = replaceGenerics(type.items, knownTypes, generics);
      }
      replacedTypes.addType(newType);
    }
  }
  // Remove 'Any' types if there is something more specific
  if (replacedTypes.type.find((t) => t.kind !== 'Any')) {
    replacedTypes.type = replacedTypes.type.filter((t) => t.kind !== 'Any');
  }
  return replacedTypes;
}
