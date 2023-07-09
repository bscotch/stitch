import { arrayWrapped, isArray } from '@bscotch/utility';
import type { Signifier } from './signifiers.js';
import type { Type, TypeStore } from './types.js';
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
  kind: T | T[],
): { [Kind in T]: Type<Kind> }[T] | undefined {
  if (!from) return undefined;
  const types = getTypes(from);
  const kinds = arrayWrapped(kind) as T[];
  return types.find((t) => kinds.includes(t.kind as any)) as
    | Type<T>
    | undefined;
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

export function getTypes(
  items: Signifier | Type | TypeStore | (Type | TypeStore)[],
): Type[] {
  const types: Type[] = [];
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
    if (!matching || !narrows(matching.type, member.type)) {
      return false;
    }
  }
  // Similarly, the subtype must have the same params (though it could have others)
  for (const param of broadType.listParameters()) {
    const matching = narrowType.getParameter(param.idx!);
    if (!matching || !narrows(matching.type, param.type)) {
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
    broadType.constructs &&
    (!narrowType.constructs ||
      !narrows(narrowType.constructs, broadType.constructs))
  ) {
    return false;
  }

  return true;
}
