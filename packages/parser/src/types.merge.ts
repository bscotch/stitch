import { narrows } from './types.checks.js';
import { Type } from './types.js';

/** Create a new type that combines multiple other types. */
export function mergeManyTypes(types: Type[]): Type {
  let result: Type = new Type('Unknown');
  for (const type of types) {
    result = mergeTypes(result, type);
  }
  return result;
}

export function mergeTypes(original: Type | undefined, withType: Type): Type {
  // If the incoming type is unknown, toss it.
  // If the original type is Any/Mixed, then it's already as wide as possible so don't change it.
  if (!original) {
    return withType;
  }
  original.name ||= withType.name;
  original.description ||= withType.description;

  if (withType.kind === 'Unknown' || ['Any', 'Mixed'].includes(original.kind)) {
    return original;
  }
  // If the original type is unknown, now we know it! So just replace it.
  // Similarly, if both types are the same kind we'll need to merge some fields.
  if (
    original.kind === 'Unknown' ||
    (original.kind === withType.kind && original.kind !== 'Union') ||
    narrows(withType, original)
  ) {
    return original.coerceTo(withType);
  }
  if (narrows(original, withType)) {
    return original;
  }

  // Otherwise we're going to add a type to a union. If we aren't a union, convert to one.
  if (original.kind !== 'Union') {
    const unionType = new Type('Union');
    // Get a copy of the current type to add to the new union
    const preUnionType = original.clone();
    // Then convert it to a union
    original.coerceTo(unionType);
    // Then add the previous type to the union
    original.types = [preUnionType];
  }
  // Add the new type to the union
  original.types ??= [];
  original.types.push(withType);
  return original;
}
