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

import { ok } from 'assert';

interface JsdocTypeUnion {
  kind: 'union';
  types: JsdocType[];
}

interface JsdocType {
  kind: 'type';
  name: string;
  of?: JsdocTypeUnion;
}

export function parseJsdocTypeString(typeString: string): JsdocTypeUnion {
  // Patterns
  const whitespace = /\s+/y;
  const leftBracket = /[<[]/y;
  const rightBracket = /[>\]]/y;
  const or = /(\bOR\b|\bor\b|\||,)/y;
  const identifier = /[a-zA-Z_][a-zA-Z0-9_.]*/y;
  let currentPosition = 0;

  const lex = (pattern: RegExp) => {
    pattern.lastIndex = currentPosition;
    const match = pattern.exec(typeString);
    if (!match) {
      return;
    }
    currentPosition = pattern.lastIndex;
    return match;
  };
  const rootUnion: JsdocTypeUnion = { kind: 'union', types: [] };
  const typeUnionStack: JsdocTypeUnion[] = [rootUnion];
  0;
  const currentUnion = (): JsdocTypeUnion => typeUnionStack.at(-1)!;
  let currentType: JsdocType | undefined;

  // Lex the string
  while (currentPosition < typeString.length) {
    let match: RegExpExecArray | undefined;

    match = lex(leftBracket);
    if (match) {
      ok(currentType, 'Unexpected left bracket');
      // Create a new union
      const union: JsdocTypeUnion = { kind: 'union', types: [] };
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
      const type: JsdocType = {
        kind: 'type',
        name: match[0],
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
