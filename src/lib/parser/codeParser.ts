/**
 * @file We need to be able to parse code in multiple contexts (scripts, objects),
 * so storing all parsing functionality as an independent library is helpful.
 */

import { assert, StitchError } from '@/errors';
import XRegExp from 'xregexp';
import { Gms2ResourceBase } from '../components/resources/Gms2ResourceBase';
import { GmlToken } from './GmlToken';
import { GmlTokenLocation } from './GmlTokenLocation';
import { GmlTokenVersioned } from './GmlTokenVersioned';

export interface GmlTokenReferenceOptions {
  versionSuffix?: string;
}

const functionNameRegex = /\bfunction\s*(?<name>[a-zA-Z_][a-zA-Z0-9_]+)/;

function countMatches(source: string, pattern: RegExp) {
  return source.match(new RegExp(pattern, 'g'))?.length || 0;
}

/**
 * Replace a portion of a string, starting at `start`,
 * and subsequent `length` chars with a different string
 */
export function stringReplaceSegment(
  string: string,
  start: number,
  length: number,
) {
  const leftSide = string.slice(0, start);
  const rightSide = string.slice(start + length);
  const middle = string
    .slice(start, start + length)
    .split('')
    .map((char) => (char == '\n' ? char : ' '))
    .join('');
  return `${leftSide}${middle}${rightSide}`;
}

/**
 * Return a copy of the source GML with all comments and
 * strings replaced with whitespace, preserving the ovderall
 * structure of the GML but preventing such content from
 * confusing other parser activities (stuff inside strings
 * and comments can use keywords or variable names without
 * creating references -- further, string and comment delimiters
 * can confuse *each other*, so clearing all of that is helpful.)
 */
export function stripCommentsAndStringsFromGml(gml: string) {
  // Start of either a string or comment
  let stripped = gml;
  const leftDelimiterNames = [
    'commentMulti',
    'commentSingle',
    'quoteMulti',
    'quoteSingle',
  ] as const;
  const leftDelimiterRegex = /((?<commentMulti>(?<!\/)\/\*)|(?<commentSingle>\/\/.*)|(?<quoteMulti>@["'])|(?<quoteSingle>"))/g;

  const findRightPosition = (endRegex: RegExp, startFrom: number) => {
    assert(endRegex.global, 'End-regex must be global');
    endRegex.lastIndex = startFrom;
    const rightMatch = endRegex.exec(stripped);
    return rightMatch
      ? rightMatch.index + rightMatch[0].length
      : stripped.length;
  };

  const removed: {
    code: string;
    type: 'comment' | 'string';
    position: number;
  }[] = [];

  let leftDelimiterMatch: RegExpMatchArray | null;
  while (true) {
    leftDelimiterMatch = leftDelimiterRegex.exec(stripped);
    if (!leftDelimiterMatch) {
      break;
    }
    const leftDelimiterGroups = leftDelimiterMatch.groups as {
      [N in typeof leftDelimiterNames[number]]?: string;
    };
    const left = leftDelimiterMatch.index as number;
    const leftText = leftDelimiterMatch[1];
    let right = left + leftText.length;
    let type!: typeof removed[number]['type'];
    let replaceLeftOffset = 0;
    let replaceRightOffset = 0;

    // Move the start/end based on what type of thing we got.
    for (const delimiterName of leftDelimiterNames) {
      if (!leftDelimiterGroups[delimiterName]) {
        // Not this one!
        continue;
      }
      // Based on the delimiter find the index of the end of what it controls
      if (delimiterName == 'commentSingle') {
        // Then we already have it (goes to end of line)!
        type = 'comment';
      } else if (delimiterName == 'quoteSingle') {
        // Move the start point to AFTER the quote, and end to BEFORE endquote
        // Need to get the end quote but skip ESCAPED quotes
        const endRegex = /(?<!\\)"/g;
        right = findRightPosition(endRegex, right);
        replaceLeftOffset += 1;
        replaceRightOffset -= 1;
        type = 'string';
      } else if (delimiterName == 'commentMulti') {
        // Find the end delimiter
        const endRegex = /\*\//g;
        right = findRightPosition(endRegex, right);
        type = 'comment';
      } else if (delimiterName == 'quoteMulti') {
        // Find the end. Could be either a ' or " delimiter
        const endRegex = leftText.includes('"') ? /"/g : /'/g;
        right = findRightPosition(endRegex, right);
        replaceLeftOffset += 2;
        replaceRightOffset -= 1;
        type = 'string';
      } else {
        throw new StitchError('Somehow matched a non-existent delimiter');
      }
      break;
    }
    leftDelimiterRegex.lastIndex = right;

    removed.push({ code: stripped.slice(left, right), position: left, type });
    stripped = stringReplaceSegment(
      stripped,
      left + replaceLeftOffset,
      right + replaceRightOffset - (left + replaceLeftOffset),
    );
  }
  return {
    input: gml,
    stripped,
    removed,
  };
}

/**
 * Find all functions defined in the outer scope for
 * some chunk of GML.
 */
export function findOuterFunctions<
  Resource extends Gms2ResourceBase = Gms2ResourceBase
>(gml: string, resource?: Resource) {
  let strippedGml = stripCommentsAndStringsFromGml(gml).stripped;
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

  const foundFuncs: GmlToken[] = [];
  let match: RegExpMatchArray | null;
  const functionNameRegexGlobal = new RegExp(functionNameRegex, 'g');
  while (true) {
    match = functionNameRegexGlobal.exec(strippedGml);
    if (!match) {
      break;
    }
    // The location is actually where the `function` token starts,
    // we want to have the position & column where the *name* starts
    const tokenOffset = match[0].match(/^(function\s+)/)![1].length;
    const location = GmlTokenLocation.createFromMatch(
      strippedGml,
      match,
      tokenOffset,
    );
    location.resource = resource;
    foundFuncs.push(new GmlToken(match!.groups!.name, location));
  }
  return foundFuncs;
}

export function findTokenReferences<
  Resource extends Gms2ResourceBase = Gms2ResourceBase
>(gml: string, name: string, resource?: Resource, suffixPattern?: string) {
  // The function might already have the suffix. If so, need
  // to get the basename.
  const strippedGml = stripCommentsAndStringsFromGml(gml).stripped;
  let basename = name;
  if (suffixPattern) {
    const suffixMatch = name.match(new RegExp(`^(.*?)${suffixPattern}$`));
    if (suffixMatch) {
      basename = suffixMatch[1];
    }
  }
  const functionRegex = new RegExp(
    `\\b(?<token>${basename}(?<suffix>${suffixPattern || ''}))\\b`,
    'g',
  );
  const refs: GmlTokenVersioned[] = [];
  let match: RegExpMatchArray | null;
  while (true) {
    match = functionRegex.exec(strippedGml);
    if (!match) {
      break;
    }
    const token = match.groups!.token;
    const location = GmlTokenLocation.createFromMatch(strippedGml, match);
    location.resource = resource;
    const ref = new GmlTokenVersioned(token, location, name);
    refs.push(ref);
  }
  return refs;
}
