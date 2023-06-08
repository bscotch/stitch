import { keysOf } from '@bscotch/utility';
import type { IPosition, IRange } from './project.location.js';

interface MatchGroups {
  param?: string;
  description?: string;
  function?: string;
  returns?: string;
  pure?: string;
  ignore?: string;
  deprecated?: string;
  self?: string;
  type?: string;
  unknown?: string;
  typeGroup?: string;
  typeUnion?: string;
  delim?: string;
  info?: string;
  name?: string;
  default?: string;
  optionalName?: string;
  tag?: string;
}
type MatchIndex = [start: number, end: number];
type MatchIndices = { [K in keyof MatchGroups]?: MatchIndex };

const patterns = {
  param: `@(param(eter)?|arg(ument)?)\\b`,
  description: `@desc(ription)?\\b`,
  function: `@func(tion)?\\b`,
  returns: `@returns?\\b`,
  pure: `@pure\\b`,
  ignore: `@ignore\\b`,
  deprecated: `@deprecated\\b`,
  self: `@(context|self)\\b`,
  type: `@type\\b`,
  unknown: `@\\w+\\b`,
};
const typeGroupPattern = `(?<typeGroup>{\\s*(?<typeUnion>[^}]*?)?\\s*})`;
const linePrefixPattern = `^(\\s*(?<delim>///|\\*)\\s*)?`;
const descriptionPattern = `(?<info>.*)`;
const paramNamePattern = `(?<name>[a-zA-Z_]+)`;
const paramDefaultPattern = `(?:\\s*=\\s*(?<default>[^\\]]+?)\\s*)`;
const dotdotdot = `\\.\\.\\.`;
const optionalParamNamePattern = `\\[\\s*(?<optionalName>(?:[a-zA-Z_]+|${dotdotdot}))\\s*${paramDefaultPattern}?\\]`;

const names = keysOf(patterns);
for (const tagName of names) {
  // Add the line prefix and a tag capture group
  patterns[
    tagName
  ] = `${linePrefixPattern}(?<tag>(?<${tagName}>${patterns[tagName]}))`;
}

// Types with required typeGroups
const typeTags = ['returns', 'type'] as const;
for (const tagName of typeTags) {
  patterns[tagName] = `${patterns[tagName]}\\s*${typeGroupPattern}`;
}

// Params
patterns.param = `${patterns.param}(\\s+${typeGroupPattern})?\\s+(${paramNamePattern}|${optionalParamNamePattern})`;

// Self (has a type but no group)
patterns.self = `${patterns.self}\\s+(?<type>[a-zA-Z_.]+)`;

// Descriptions
for (const tagName of names) {
  patterns[tagName] = `${patterns[tagName]}(\\s+${descriptionPattern})?`;
}
const descriptionLine = `${linePrefixPattern}\\s*${descriptionPattern}`;

const regexes: Record<(typeof names)[number], RegExp> = names.reduce(
  (acc, tagName) => {
    acc[tagName] = new RegExp(patterns[tagName], 'd');
    return acc;
  },
  {} as any,
);

export type JsdocTagKind = keyof typeof patterns;

export type JsdocKind =
  | 'function'
  | 'description'
  | 'type'
  | 'param'
  | 'self'
  | 'returns';

export interface JsdocComponent extends IRange {
  /** The string content of this token */
  content: string;
}

export interface Jsdoc<T extends JsdocKind = JsdocKind> extends IRange {
  kind: T;
  tag?: JsdocComponent;
  description: string;
  ignore?: boolean;
  deprecated?: boolean;
  params?: Jsdoc<'param'>[];
  /** Return type as GML typestring */
  returns?: Jsdoc<'returns'>;
  /** Parameter name */
  name?: JsdocComponent;
  /** If is an optional param */
  optional?: boolean;
  /** Parameter, or Type */
  type?: JsdocComponent;
  /** For functions or self docs */
  self?: JsdocComponent;
}

export interface JsdocSummary
  extends Jsdoc<'description' | 'function' | 'type' | 'self'> {
  /**
   * The list of all tags found in this block, and their
   * respective locations, for use e.g. syntax highlighting.
   */
  tags: JsdocComponent[];
}

export function parseJsdocString(
  jsdocString: string,
  /**
   * The position of the first character of the jsdoc string,
   * if it has been parsed out of a larger document. This is
   * used to offset the positions of discovered tag components.
   */
  startPosition?: IPosition,
): JsdocSummary {
  const currentPosition = startPosition || {
    line: 1,
    column: 1,
    offset: 0,
  };
  const lines = jsdocString.split(/(\r?\n)/);
  // Default to a description-only doc, and update its type
  // if we can infer it based on the tags.
  const doc: JsdocSummary = {
    kind: 'description',
    description: '',
    start: { ...currentPosition },
    // TODO: Update this!
    end: { ...currentPosition },
    tags: [],
  };
  let describing: Jsdoc | null = doc;
  const appendDescription = (
    currentDescription: string,
    newDescription?: string,
  ) => {
    newDescription ||= '';
    if (currentDescription) {
      return `${currentDescription}\n${newDescription}`;
    }
    return newDescription;
  };

  for (let l = 0; l < lines.length; l++) {
    const line = lines[l];
    currentPosition.column = 1;
    // Update the end position
    doc.end.line = currentPosition.line;
    doc.end.column = 1 + line.length;
    doc.end.offset += line.length;

    if (!line) {
      continue;
    }
    // If the line is just a newline, update the counters and continue
    if (line.match(/\r?\n/)) {
      currentPosition.line++;
      doc.end.line = currentPosition.line;
      currentPosition.offset += line.length;
      continue;
    }

    // Check for a match against each of the tag patterns
    // until we fined one. If we don't then `match` will
    // stay null, and we can use the line as a description.
    let match: RegExpMatchArray | null = null;
    for (const tagName of names) {
      match = line.match(regexes[tagName]) as RegExpMatchArray;
      const parts = match?.groups as MatchGroups;
      const indices = match?.indices?.groups as MatchIndices;
      if (!match) {
        // Then we haven't found a tag yet
        continue;
      }
      // Add the tag to the list of tags
      doc.tags.push({
        content: parts.tag!,
        ...matchIndexToRange(currentPosition, indices.tag!),
      });

      // Based on the tag type, update the doc
      const impliesFunction =
        parts.function || parts.param || parts.returns || parts.pure;
      if (impliesFunction) {
        doc.kind = 'function';
      }

      const entireMatchRange = matchIndexToRange(
        currentPosition,
        match.indices![0],
      );

      // If this uses an @description tag, then apply that description
      // to the root doc.
      if (parts.description) {
        doc.description = appendDescription(doc.description, parts.info);
      }
      // If it's an unfamiliar tag, just skip it
      else if (parts.unknown) {
        // Unset the describe target
        describing = null;
      }
      // Handle params
      else if (parts.param) {
        const param: Jsdoc<'param'> = {
          kind: 'param',
          name: matchToComponent(
            match,
            parts.name ? 'name' : 'optionalName',
            currentPosition,
          ),
          optional: !!parts.optionalName,
          type: matchToComponent(match, 'typeUnion', currentPosition),
          description: parts.info || '',
          ...entireMatchRange,
        };
        doc.params = doc.params || [];
        doc.params.push(param);
        // Update the current describing object in case the next line is a description
        describing = param;
      }
      // Handle returns
      else if (parts.returns) {
        if (doc.returns) {
          // Then we don't want to overwrite.
          break;
        }
        const returns: Jsdoc<'returns'> = {
          kind: 'returns',
          type: matchToComponent(match, 'typeUnion', currentPosition),
          description: parts.info || '',
          ...entireMatchRange,
        };
        doc.returns = returns;
        // Update the current describing object in case the next line is a description
        describing = returns;
      }
      // Handle Self
      else if (parts.self) {
        doc.self = matchToComponent(match, 'type', currentPosition);
      }
      // Handle Type
      else if (parts.type) {
        doc.kind = 'type';
        doc.type = matchToComponent(match, 'typeUnion', currentPosition);
        doc.description = appendDescription(doc.description, parts.info);
      }
      // Handle modifiers
      else if (parts.deprecated) {
        doc.deprecated = true;
      } else if (parts.ignore) {
        doc.ignore = true;
      }
      break;
    }
    // If we haven't found a tag, then this is a description line
    // Then this is a description-only line (or something invalid).
    // Apply it to the current describing object.
    if (!match && describing) {
      const descriptionMatch = line.match(descriptionLine);
      if (descriptionMatch) {
        describing.description = appendDescription(
          describing.description,
          descriptionMatch.groups?.info,
        );
      }
    }
    currentPosition.offset += line.length;
  }
  if (doc.kind === 'description' && doc.self) {
    // Then we don't know for sure what this context is for,
    // but it's useful to call it a self doc.
    doc.kind = 'self';
  }
  return doc;
}

function matchToComponent(
  match: RegExpMatchArray,
  groupName: string,
  startPosition: IPosition,
): JsdocComponent {
  return {
    content: match.groups![groupName]!,
    ...matchIndexToRange(startPosition, match.indices!.groups![groupName]!),
  };
}

function matchIndexToRange(
  startPosition: IPosition,
  index: MatchIndex,
): IRange {
  // Note that the IRange uses column and line indexes that start at 1, while the offset starts at 0.
  const range: IRange = {
    start: { ...startPosition },
    end: { ...startPosition },
  };
  range.start.column += index[0];
  range.start.offset += index[0];
  range.end.column += index[1];
  range.end.offset += index[1];
  return range;
}
