/**
 * @file We need to be able to parse code in multiple contexts (scripts, objects),
 * so storing all parsing functionality as an independent library is helpful.
 */

import XRegExp from 'xregexp';
import { Gms2ResourceBase } from './components/resources/Gms2ResourceBase';

const functionNameRegex = /\bfunction\s*(?<name>[a-zA-Z_][a-zA-Z0-9_]+)/;

function countMatches(source: string, pattern: RegExp) {
  return source.match(new RegExp(pattern, 'g'))?.length || 0;
}

export class GmlTokenLocation<
  Resource extends Gms2ResourceBase = Gms2ResourceBase
> {
  private _resource?: Resource;
  constructor(
    readonly position: number,
    readonly line: number,
    readonly column: number,
  ) {}

  set resource(resource: Resource | undefined) {
    this._resource = resource;
  }
  get resource() {
    return this._resource;
  }

  isSameLocation(otherLocation: GmlTokenLocation) {
    if (!this.resource || !otherLocation.resource) {
      // Then one's location is undefined.
      return false;
    }
    return (['position', 'column', 'line'] as const).every(
      (posField) => this[posField] == otherLocation[posField],
    );
  }

  static createFromMatch(
    source: string,
    match: RegExpMatchArray,
    offsetPosition = 0,
  ) {
    const position = (match.index as number) + offsetPosition;
    const lines = source.slice(0, position).split(/\r?\n/g);
    return new GmlTokenLocation(
      position,
      lines.length - 1,
      lines[lines.length - 1].length,
    );
  }
}

export class GmlToken {
  constructor(readonly name: string, readonly location: GmlTokenLocation) {}
}

/**
 * In order to make refactoring GML code easier, in particular when a token
 * (such as a function name) has changed its type such that any references to
 * it need to be examined, having a "versioning" system on tokens can make
 * that possible. For example, renaming a function from 'myFunc' to 'myFunc_v1'
 * when its inputs or outputs have changed allows for easy identification of
 * all cases where the old references to that function have not been updated.
 */
export class GmlTokenVersioned extends GmlToken {
  /**
   * @param expectedName A function reference may refer to an outdated name for some particular function.
   * If so, the `expectedName` is the *current* name of that function, which may deviate
   * from this *reference's* actual name.
   */
  constructor(
    name: string,
    location: GmlTokenLocation,
    private expectedName?: string,
  ) {
    super(name, location);
  }

  get isCorrectVersion() {
    return this.expectedName == this.name;
  }
}

/**
 * Find all functions defined in the outer scope for
 * some chunk of GML.
 */
export function findOuterFunctions<
  Resource extends Gms2ResourceBase = Gms2ResourceBase
>(gml: string, resource?: Resource) {
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
    match = functionRegex.exec(gml);
    if (!match) {
      break;
    }
    const token = match.groups!.token;
    const location = GmlTokenLocation.createFromMatch(gml, match);
    location.resource = resource;
    const ref = new GmlTokenVersioned(token, location, name);
    refs.push(ref);
  }
  return refs;
}
