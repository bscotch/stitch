/**
 * @file We need to be able to parse code in multiple contexts (scripts, objects),
 * so storing all parsing functionality as an independent library is helpful.
 */

import XRegExp from 'xregexp';

const functionNameRegex = /\bfunction\s*(?<name>[a-zA-Z_][a-zA-Z0-9_]+)/;

export interface GmlFunctionReference {
  name: string;
  fullName: string;
  suffix?: string;
  position: number;
  line: number;
  column: number;
}

export interface GmlFunction {
  name: string;
}

/**
 * Find all functions defined in the outer scope for
 * some chunk of GML.
 */
export function findOuterFunctions(gml: string): GmlFunction[] {
  let strippedGml = gml;
  const innerScopes = XRegExp.matchRecursive(gml, '{', '}', 'igms').filter(
    (x) => x,
  );
  for (const innerScope of innerScopes) {
    strippedGml = strippedGml.replace(innerScope, '');
  }

  return (strippedGml.match(new RegExp(functionNameRegex, 'g')) || []).map(
    (match) => {
      const name = match.match(functionNameRegex)!.groups!.name;
      return { name };
    },
  );
}

export function findFunctionReferences(
  gml: string,
  functionName: string,
  suffixPattern?: string,
) {
  // The function might already have the suffix. If so, need
  // to get the basename.
  let basename = functionName;
  if (suffixPattern) {
    const suffixMatch = functionName.match(
      new RegExp(`^(.*?)${suffixPattern}$`),
    );
    if (suffixMatch) {
      basename = suffixMatch[1];
    }
  }
  const functionRegex = new RegExp(
    `\\b(?<fullName>${basename}(?<suffix>${suffixPattern || ''}))\\b`,
    'g',
  );
  const refs: GmlFunctionReference[] = [];
  let match: RegExpMatchArray | null;
  while (true) {
    match = functionRegex.exec(gml);
    if (!match) {
      break;
    }
    const lines = gml.slice(0, match.index as number).split(/\r?\n/g);
    const ref: GmlFunctionReference = {
      name: functionName,
      fullName: match.groups!.fullName,
      suffix: match.groups!.suffix,
      position: match.index as number,
      line: lines.length - 1,
      column: lines[lines.length - 1].length,
    };
    refs.push(ref);
  }
  return refs;
}
