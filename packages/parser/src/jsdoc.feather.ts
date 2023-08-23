// Handle GameMaker JSDoc typestrings
// GameMaker allows for some variations on the allowed syntax.
// Examples:
//  - `String`
//  - `String|Real`
//  - `String,Real`
//  - `String OR Real`
//  - `Array`
//  - `Array<String>`
//  - `Array[String|Real]`

import type { Type } from './types.js';
import { ok } from './util.js';

export interface FeatherTypeUnion {
  kind: 'union';
  types: FeatherType[];
}

export interface FeatherType {
  kind: 'type';
  name: {
    content: string;
    offset: number;
    inferred?: boolean;
  };
  of?: FeatherTypeUnion;
}

/**
 * Given a parsed feather type, create a flat array of flat types.
 * Useful for e.g. getting the offsets of all types in a union.
 * @param flattened The array collecting the flattened types
 */
export function flattenFeatherTypes(
  type: FeatherTypeUnion | FeatherType | string,
  flattened: FeatherType[] = [],
): FeatherType[] {
  if (typeof type === 'string') {
    return flattenFeatherTypes(parseFeatherTypeString(type), flattened);
  }
  if (type.kind === 'type') {
    flattened.push(type);
    if (type.of) {
      flattenFeatherTypes(type.of, flattened);
    }
  } else {
    type.types.forEach((t) => flattenFeatherTypes(t, flattened));
  }
  return flattened;
}

export function parseFeatherTypeString(typeString: string): FeatherTypeUnion {
  // Patterns
  const whitespace = /\s+/y;
  const leftBracket = /[<[]/y;
  const rightBracket = /[>\]]/y;
  const or = /(\bOR\b|\bor\b|\||,)/y;
  const identifier = /[a-zA-Z_][a-zA-Z0-9_.]*/y;
  let offset = 0;

  const lex = (pattern: RegExp) => {
    pattern.lastIndex = offset;
    const match = pattern.exec(typeString);
    if (!match) {
      return;
    }
    offset = pattern.lastIndex;
    return match;
  };
  const rootUnion: FeatherTypeUnion = { kind: 'union', types: [] };
  const typeUnionStack: FeatherTypeUnion[] = [rootUnion];
  0;
  const currentUnion = (): FeatherTypeUnion => typeUnionStack.at(-1)!;
  let currentType: FeatherType | undefined;

  if (!typeString?.trim()) {
    rootUnion.types.push({
      kind: 'type',
      name: { content: 'Any', inferred: true, offset },
    });
    return rootUnion;
  }

  // Lex the string
  while (offset < typeString.length) {
    let match: RegExpExecArray | undefined;

    match = lex(leftBracket);
    if (match) {
      ok(currentType, 'Unexpected left bracket');
      // Create a new union
      const union: FeatherTypeUnion = { kind: 'union', types: [] };
      // Add it to the current type
      currentType.of = union;
      // Push it onto the stack
      typeUnionStack.push(union);
      continue;
    }

    match = lex(rightBracket);
    if (match) {
      // Pop the current union off the stack
      typeUnionStack.pop();
      // Can only be followed by an OR, so unset the type
      currentType = undefined;
      continue;
    }

    match = lex(or);
    if (match) {
      continue;
    }

    match = lex(identifier);
    if (match) {
      // Create a new type
      const type: FeatherType = {
        kind: 'type',
        name: { content: match[0], offset: match.index },
      };
      // Add it to the current union
      currentUnion().types.push(type);
      currentType = type;
      continue;
    }

    match = lex(whitespace);
    if (match) {
      continue;
    }
    break;
  }

  return rootUnion;
}

export function typeToFeatherString(type: Type): string {
  // Functions, Structs, and Enums are the only types that can have names
  if (type.isGeneric && type.name) {
    return type.name;
  }
  if (type.signifier?.enumMember) {
    const parent = type.signifier.parent;
    return `Enum.${parent.name}.${type.name}`;
  }
  if (type.signifier?.enum) {
    return `Enum.${type.name}`;
  }
  if (type.name) {
    if (['Real', 'String', 'Boolean'].includes(type.kind)) {
      // Then this is a constant, represented in Feather as `Constant.<Class>`
      return `Constant.${type.name}`;
    }
    return `${type.kind}.${type.name}`;
  }
  // Arrays etc can contain items of a type) {
  if (type.items?.type.length) {
    return `${type.kind}<${type.items.type
      .map((t) => t.toFeatherString())
      .join('|')}>`;
  }
  return type.kind;
}
