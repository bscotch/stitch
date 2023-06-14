import { Type } from './types.js';

export function mergeTypes(original: Type | undefined, withType: Type): Type {
  // If the incoming type is unknown, toss it.
  // If the original type is Any/Mixed, then it's already as wide as possible so don't change it.
  if (!original) {
    return withType;
  }
  if (withType.kind === 'Unknown' || ['Any', 'Mixed'].includes(original.kind)) {
    return original;
  }
  // If the original type is unknown, now we know it! So just replace it.
  // Similarly, if both types are the same kind we'll need to merge some fields.
  if (
    original.kind === 'Unknown' ||
    (original.kind === withType.kind && original.kind !== 'Union')
  ) {
    original.kind = withType.kind;
    original.name ||= withType.name;
    original.description ||= withType.description;
    original.parent ||= withType.parent;
    original._members ||= withType._members;
    original.items ||= withType.items;
    original.types ||= withType.types;
    original.constructs ||= withType.constructs;
    original.context ||= withType.context;
    original._params ||= withType._params;
    original.returns ||= withType.returns;
    return original;
  }
  // Otherwise we're going to add a type to a union. If we aren't a union, convert to one.
  if (original.kind !== 'Union') {
    const unionType = new Type('Union');
    // Get a copy of the current type to add to the new union
    const preUnionType = original.clone();
    // Then convert it to a union
    Object.assign(original, unionType);
    // Then add the previous type to the union
    original.types = [preUnionType];
  }
  // Add the new type to the union
  original.types ??= [];
  original.types.push(withType);
  return original;
}
