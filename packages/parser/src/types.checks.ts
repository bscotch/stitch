import type { Type } from './types.js';
import { PrimitiveName } from './types.primitives.js';

export function isTypeOfKind<T extends PrimitiveName>(
  item: any,
  kind: T,
): item is Type<T> {
  return isTypeInstance(item) && item.kind === kind;
}

export function isTypeInstance(item: any): item is Type {
  return item && '$tag' in item && item.$tag === 'Type';
}

/**
 * Returns `true` if `narrowed` is a subtype of `type`,
 * meaning that it is a subset/narrowed/compatible/same type
 * compared to otherType.
 *
 * Identical types also return `true`.
 */
export function narrows(narrowType: Type, broadType: Type): boolean {
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

  if (broadType.kind === 'Union') {
    // Then the subtype must satisfy at least one of the union members.
    // If the subtype itself is a union, *every* type must be satisfied.
    if (narrowType.kind === 'Union') {
      return narrowType.types?.every((t) => narrows(t, broadType)) ?? false;
    } else {
      return broadType.types?.some((t) => narrows(narrowType, t)) ?? false;
    }
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
