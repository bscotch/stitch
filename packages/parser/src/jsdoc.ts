import { keysOf } from '@bscotch/utility';

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

export interface Jsdoc<T extends JsdocKind = JsdocKind> {
  kind: T;
  description: string;
  ignore?: boolean;
  deprecated?: boolean;
  params?: Jsdoc<'param'>[];
  /** Return type as GML typestring */
  returns?: Jsdoc<'returns'>;
  /** Parameter name */
  name?: string;
  /** If is an optional param */
  optional?: boolean;
  /** Parameter, or Type */
  type?: string;
  /** For functions or self docs */
  self?: string;
}

export function parseJsdocString(jsdocString: string) {
  const lines = jsdocString.split(/\r?\n/);
  // Default to a description-only doc, and update its type
  // if we can infer it based on the tags.
  const doc: Jsdoc<'description' | 'function' | 'type' | 'self'> = {
    kind: 'description',
    description: '',
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
    let match: RegExpMatchArray | null = null;
    for (const tagName of names) {
      match = line.match(regexes[tagName]) as RegExpMatchArray | null;
      const parts = match?.groups as MatchGroups;
      if (!match) {
        // Then we haven't found a tag yet
        continue;
      }
      // If this uses an @description tag, then apply that description
      // to the root doc.
      if (parts.description) {
        doc.description = appendDescription(doc.description, parts.info);
        break;
      }
      // If it's an unfamiliar tag, just skip it
      if (parts.unknown) {
        // Unset the describe target
        describing = null;
        break;
      }

      // Based on the tag type, update the doc
      const impliesFunction =
        parts.function || parts.param || parts.returns || parts.pure;
      if (impliesFunction) {
        doc.kind = 'function';
      }
      // Handle params
      if (parts.param) {
        const param: Jsdoc<'param'> = {
          kind: 'param',
          name: (parts.name || parts.optionalName)!,
          optional: !!parts.optionalName,
          type: parts.typeUnion,
          description: parts.info || '',
        };
        doc.params = doc.params || [];
        doc.params.push(param);
        // Update the current describing object in case the next line is a description
        describing = param;
      }
      // Handle returns
      if (parts.returns) {
        if (doc.returns) {
          // Then we don't want to overwrite.
          break;
        }
        const returns: Jsdoc<'returns'> = {
          kind: 'returns',
          type: parts.typeUnion,
          description: parts.info || '',
        };
        doc.returns = returns;
        // Update the current describing object in case the next line is a description
        describing = returns;
        break;
      }
      // Handle Self
      if (parts.self) {
        doc.self = parts.type;
        break;
      }
      // Handle Type
      if (parts.type) {
        doc.kind = 'type';
        doc.type = parts.typeUnion;
        doc.description = appendDescription(doc.description, parts.info);
      }

      // Handle modifiers
      if (parts.deprecated) {
        doc.deprecated = true;
      }
      if (parts.ignore) {
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
  }
  if (doc.kind === 'description' && doc.self) {
    // Then we don't know for sure what this context is for,
    // but it's useful to call it a self doc.
    doc.kind = 'self';
  }
  return doc;
}
