/**
 * @file We need to be able to parse code in multiple contexts (scripts, objects),
 * so storing all parsing functionality as an independent library is helpful.
 */

import XRegExp from 'xregexp';
import { Gms2ResourceType } from './components/Gms2ResourceArray';

const functionNameRegex = /\bfunction\s*(?<name>[a-zA-Z_][a-zA-Z0-9_]+)/;

function countMatches(source: string, pattern: RegExp) {
  return source.match(new RegExp(pattern, 'g'))?.length || 0;
}

function locationOfMatch(source: string, match: RegExpMatchArray) {
  const lines = source.slice(0, match.index as number).split(/\r?\n/g);
  return {
    position: match.index as number,
    line: lines.length - 1,
    column: lines[lines.length - 1].length,
  };
}

export interface GmlToken {
  name: string;
  location: {
    resource?: {
      type: Gms2ResourceType;
      name: string;
    };
    position: number;
    line: number;
    column: number;
  };
}

export interface GmlFunctionReference extends GmlToken {
  /** If doing a versioned-function search, the exact name we had expected to find */
  expectedName?: string;
  /** If doing a versioned-function search, the version-suffix pattern */
  suffix?: string;
  /**
   * If doing a versions-function search, and the version we found does not match
   * the exact one searched for.
   */
  unexpectedVersion?: boolean;
}

export type GmlFunction = GmlToken; // Once we have features to add, extend this for functions

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
    // Create a filler with the same string lengh and number of newlines
    const totalNewlines = countMatches(innerScope, /\n/);
    const filler = `${' '.repeat(
      innerScope.length - totalNewlines,
    )}${'\n'.repeat(totalNewlines)}`;
    strippedGml = strippedGml.replace(innerScope, filler);
  }

  const foundFuncs: GmlFunction[] = [];
  let match: RegExpMatchArray | null;
  const functionNameRegexGlobal = new RegExp(functionNameRegex, 'g');
  while (true) {
    match = functionNameRegexGlobal.exec(strippedGml);
    if (!match) {
      break;
    }
    // The location is actually where the `function` token starts,
    // we want to have the position & column where the *name* starts
    const location = locationOfMatch(strippedGml, match);
    const tokenOffset = match[0].match(/^(function\s+)/)![1].length;
    location.column += tokenOffset;
    location.position += tokenOffset;
    foundFuncs.push({
      name: match!.groups!.name,
      location,
    });
  }
  return foundFuncs;
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
    const name = match.groups!.fullName;
    const ref: GmlFunctionReference = {
      name,
      location: locationOfMatch(gml, match),
      expectedName: functionName,
      suffix: match.groups!.suffix,
      unexpectedVersion: Boolean(suffixPattern && name != functionName),
    };
    refs.push(ref);
  }
  return refs;
}
