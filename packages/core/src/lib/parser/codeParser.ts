import XRegExp from 'xregexp';
import { assert, StitchError } from '../../utility/errors.js';
import { Gms2ResourceBase } from '../components/resources/Gms2ResourceBase.js';
import { GmlToken } from './GmlToken.js';
import { GmlTokenLocation } from './GmlTokenLocation.js';
import { GmlTokenVersioned } from './GmlTokenVersioned.js';

declare global {
  const hello = 'world';
}

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

export interface GmlPosition {
  code: string;
  position: number;
  length: number;
  line: number;
}

export interface GmlStripped {
  input: string;
  stripped: string;
  strings: GmlPosition[];
  comments: GmlPosition[];
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
export function stripCommentsAndStringsFromGml(gml: string): GmlStripped {
  // Start of either a string or comment
  let stripped = gml;
  const leftDelimiterNames = [
    'commentMulti',
    'commentSingle',
    'quoteMulti',
    'quoteSingle',
  ] as const;
  const leftDelimiterRegex =
    /((?<commentMulti>(?<!\/)\/\*)|(?<commentSingle>\/\/.*)|(?<quoteMulti>@["'])|(?<quoteSingle>"))/g;

  const _findRightPosition = (endRegex: RegExp, startFrom: number) => {
    assert(endRegex.global, 'End-regex must be global');
    endRegex.lastIndex = startFrom;
    const rightMatch = endRegex.exec(stripped);
    return rightMatch
      ? rightMatch.index + rightMatch[0].length
      : stripped.length;
  };

  const found: Pick<GmlStripped, 'comments' | 'strings'> = {
    strings: [],
    comments: [],
  };

  while (true) {
    const leftDelimiterMatch = leftDelimiterRegex.exec(stripped);
    if (!leftDelimiterMatch) {
      break;
    }
    const leftDelimiterGroups = leftDelimiterMatch.groups as {
      [N in typeof leftDelimiterNames[number]]?: string;
    };
    const left = leftDelimiterMatch.index as number;
    const leftText = leftDelimiterMatch[1];
    let right = left + leftText.length;
    let type: 'strings' | 'comments' = 'strings';
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
        type = 'comments';
      } else if (delimiterName == 'quoteSingle') {
        // Move the start point to AFTER the quote, and end to BEFORE endquote
        // Need to get the end quote but skip ESCAPED quotes
        const endRegex = /"/g;
        endRegex.lastIndex = right;

        while (true) {
          const match = endRegex.exec(stripped);
          assert(match, 'Found a left quote without a matching right quote.');
          right = match.index + 1;
          //We have found a right quote, but we don't know if it is escaped by having an odd number of forward slashes in front of it
          let consecutivePreviousSlashCount = 0;
          for (let position = match.index - 1; position > left; position--) {
            if (stripped[position] == '\\') {
              consecutivePreviousSlashCount++;
            } else {
              break;
            }
          }
          if (consecutivePreviousSlashCount % 2 == 1) {
            continue;
          } else {
            break;
          }
        }
        replaceLeftOffset += 1;
        replaceRightOffset -= 1;
      } else if (delimiterName == 'commentMulti') {
        // Find the end delimiter
        const endRegex = /\*\//g;
        right = _findRightPosition(endRegex, right);
        type = 'comments';
      } else if (delimiterName == 'quoteMulti') {
        // Find the end. Could be either a ' or " delimiter
        const endRegex = leftText.includes('"') ? /"/g : /'/g;
        right = _findRightPosition(endRegex, right);
        replaceLeftOffset += 2;
        replaceRightOffset -= 1;
      } else {
        throw new StitchError('Somehow matched a non-existent delimiter');
      }
      break;
    }
    leftDelimiterRegex.lastIndex = right;
    const code = stripped.slice(left, right);
    found[type].push({
      code,
      position: left,
      length: code.length,
      line: stripped.substring(0, left).split('\n').length,
    });
    stripped = stringReplaceSegment(
      stripped,
      left + replaceLeftOffset,
      right + replaceRightOffset - (left + replaceLeftOffset),
    );
  }
  return {
    input: gml,
    stripped,
    ...found,
  };
}

/**
 * Find all functions defined in the outer scope for
 * some chunk of GML.
 */
export function findOuterFunctions<
  Resource extends Gms2ResourceBase = Gms2ResourceBase,
>(gml: string, resource?: Resource) {
  let strippedGml = stripCommentsAndStringsFromGml(gml).stripped;

  const innerScopes = XRegExp.matchRecursive(
    strippedGml,
    '{',
    '}',
    'igms',
  ).filter((x) => x);
  for (const innerScope of innerScopes) {
    // Create a filler with the same string lengh and number of newlines
    const totalNewlines = countMatches(innerScope, /\n/);
    const filler = `${' '.repeat(
      innerScope.length - totalNewlines,
    )}${'\n'.repeat(totalNewlines)}`;
    strippedGml = strippedGml.replace(innerScope, filler);
  }

  const foundFuncs: GmlToken[] = [];
  let match: RegExpExecArray | null;
  const functionNameRegexGlobal = new RegExp(functionNameRegex, 'g');
  while (true) {
    match = functionNameRegexGlobal.exec(strippedGml);
    if (!match) {
      break;
    }
    // The location is actually where the `function` token starts,
    // we want to have the position & column where the *name* starts
    const offsetPosition = match[0].match(/^(function\s+)/)![1].length;
    const location = GmlTokenLocation.createFromMatch(strippedGml, match, {
      offsetPosition,
    });
    location.resource = resource;
    foundFuncs.push(new GmlToken(match!.groups!.name, location));
  }
  return foundFuncs;
}

export function findTokenReferences<
  Resource extends Gms2ResourceBase = Gms2ResourceBase,
>(
  gml: string,
  token: string | GmlToken,
  options?: {
    /**
     * The resource this GML comes from. If not provided,
     * this information will not be attached to the resulting
     * token data.
     */
    resource?: Resource;
    suffixPattern?: string;
    /**
     * By default, discovered references that are the *same* references
     * as the search token are ignored.
     */
    includeSelf?: boolean;
    /**
     * If the source GML comes from a resource with multiple GML files,
     * the sublocation should be used to differentiate.
     */
    sublocation?: string;
  },
) {
  // The function might already have the suffix. If so, need
  // to get the basename.
  const strippedGml = stripCommentsAndStringsFromGml(gml).stripped;
  const expectedName = typeof token == 'string' ? token : token.name;
  let basename = expectedName;
  if (options?.suffixPattern) {
    const suffixMatch = basename.match(
      new RegExp(`^(.*?)${options.suffixPattern}$`),
    );
    if (suffixMatch) {
      basename = suffixMatch[1];
    }
  }
  const functionRegex = new RegExp(
    `\\b(?<token>${basename}(?<suffix>${options?.suffixPattern || ''}))\\b`,
    'g',
  );
  const refs: GmlTokenVersioned[] = [];
  let match: RegExpExecArray | null;
  while (true) {
    match = functionRegex.exec(strippedGml);
    if (!match) {
      break;
    }
    const tokenMatch = match.groups!.token;
    const location = GmlTokenLocation.createFromMatch(strippedGml, match, {
      sublocation: options?.sublocation,
    });
    location.resource = options?.resource;
    const ref = new GmlTokenVersioned(tokenMatch, location, expectedName);

    // Skip if matches search token and excluding self
    if (
      typeof token != 'string' &&
      !options?.includeSelf &&
      token.isTheSameToken(ref)
    ) {
      continue;
    }
    refs.push(ref);
  }
  return refs;
}
