import { isArray } from '@bscotch/utility';
import type { AssignableType, Type } from './types.js';
import type { PrimitiveName } from './types.primitives.js';

export function isTypeOfKind<T extends PrimitiveName>(
  item: any,
  kind: T,
): item is Type<T> {
  return isTypeInstance(item) && item.kind === kind;
}

export function isTypeInstance(item: any): item is Type {
  return item && '$tag' in item && item.$tag === 'Type';
}

export function getTypes<T extends PrimitiveName>(
  item: Type<T> | readonly Type<T>[] | AssignableType<T>,
): Type[] {
  return [...(isArray(item) ? item : 'types' in item ? item.types : [item])];
}

/**
 * Returns `true` if `narrowed` is a subtype of `type`,
 * meaning that it is a subset/narrowed/compatible/same type
 * compared to otherType.
 *
 * Identical types also return `true`.
 */
export function narrows(
  narrowType: Type | Type[] | AssignableType,
  broadType: Type | Type[] | AssignableType,
): boolean {
  // Normalize to arrays of types
  const narrowTypes = getTypes(narrowType);
  const broadTypes = getTypes(broadType);
  // If every member of narrowTypes is a narrowed version of a type in broadTypes, then return true.
  for (const narrow of narrowTypes) {
    for (const broad of broadTypes) {
      if (
        ['Mixed', 'Any'].includes(broad.kind) ||
        ['Mixed', 'Any'].includes(narrow.kind)
      ) {
        // Then this narrower type does "narrow" a broader type. Move on to the next narrow type.
        break;
      }
      if (narrow.kind !== broad.kind) {
        // Then this is not narrower. Try the next broad type.
        continue;
      }
      // The subtype must have all of the same members, though it could also have others
      for (const member of broad.listMembers()) {
        const matching = narrow.getMember(member.name);
        if (!matching || !narrows(matching.type, member.type)) {
          continue;
        }
      }
      // Similarly, the subtype must have the same params (though it could have others)
      for (const param of broad.listParams()) {
        const matching = narrow.getParam(param.idx!);
        if (!matching || !narrows(matching.type, param.type)) {
          continue;
        }
      }
      // Check return type
      if (
        broad.returns &&
        (!narrow.returns || !narrows(narrow.returns, broad.returns))
      ) {
        continue;
      }
      // Check the constructs type
      if (
        broad.constructs &&
        (!narrow.constructs || !narrows(narrow.constructs, broad.constructs))
      ) {
        continue;
      }
    }
    // If we make it here then we didn't find a broad type that this
    // type narrows. So return false.
    return false;
  }
  return true;
}
