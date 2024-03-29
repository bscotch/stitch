import { keysOf } from '@bscotch/utility';
import type { IToken } from 'chevrotain';
import { flattenFeatherTypes } from './jsdoc.feather.js';
import type { IPosition, IRange } from './project.location.js';
import { assert } from './util.js';

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
  localvar?: string;
  globalvar?: string;
  instancevar?: string;
  template?: string;
  unknown?: string;
  mixin?: string;
  typeGroup?: string;
  typeUnion?: string;
  delim?: string;
  info?: string;
  name?: string;
  default?: string;
  optionalName?: string;
  tag?: string;
  extraBracket?: string;
}
type MatchIndex = readonly [start: number, end: number];
type MatchIndices = { [K in keyof MatchGroups]?: MatchIndex };

const patterns = {
  param: `@(param(eter)?|arg(ument)?)\\b`,
  description: `@desc(ription)?\\b`,
  function: `@func(tion)?\\b`,
  returns: `@returns?\\b`,
  pure: `@pure\\b`,
  mixin: `@mixin\\b`,
  ignore: `@ignore\\b`,
  deprecated: `@deprecated\\b`,
  self: `@(context|self)\\b`,
  type: `@type\\b`,
  localvar: `@(localvar|var)\\b`,
  globalvar: `@globalvar\\b`,
  instancevar: `@(instancevar|prop(erty)?)\\b`,
  template: `@template\\b`,
  unknown: `@\\w+\\b`,
};
const typeGroupPattern = `(?<typeGroup>{\\s*(?<typeUnion>[^}]*?)?\\s*})`;
const linePrefixPattern = `^(\\s*(?<delim>///|\\*)\\s*)?`;
const descriptionPattern = `(?:\\s*-\\s*)?(?<info>.*)`;
const paramNamePattern = `(?<name>[a-zA-Z_][a-zA-Z_0-9]*)`;
const paramDefaultPattern = `(?:\\s*=\\s*(?<default>[^\\]]+?)\\s*)`;
const dotdotdot = `\\.\\.\\.`;
const optionalParamNamePattern = `\\[\\s*(?<optionalName>(?:[a-zA-Z_][a-zA-Z_0-9]*|${dotdotdot}))\\s*${paramDefaultPattern}?\\]`;

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

// Variable declaration patterns
for (const tagName of [
  'localvar',
  'globalvar',
  'instancevar',
  'template',
] as const) {
  patterns[
    tagName
  ] = `${patterns[tagName]}(\\s+${typeGroupPattern})?\\s+${paramNamePattern}`;
}

// Self (has a type but no group. Make brackets optional to be more forgiving)
patterns.self = `${patterns.self}\\s+(?<extraBracket>\\{\\s*)?(?<type>[a-zA-Z_][a-zA-Z_0-9.]*)(?:\\s*\\})?`;

// Descriptions
for (const tagName of names) {
  patterns[tagName] = `${patterns[tagName]}(\\s+${descriptionPattern})?`;
}
const descriptionLine = `${linePrefixPattern}\\s*${descriptionPattern}`;

const regexes: Record<(typeof names)[number], RegExp> = names.reduce(
  (acc, tagName) => {
    // The 'd' flag is only supported in Node 18+, which VSCode doesn't support yet.
    acc[tagName] = new RegExp(patterns[tagName]);
    return acc;
  },
  {} as any,
);

export type JsdocTagKind = keyof typeof patterns;

export type JsdocKind =
  | 'function'
  | 'description'
  | 'type'
  | 'template'
  | 'param'
  | 'self'
  | 'localvar'
  | 'globalvar'
  | 'instancevar'
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
  mixin?: boolean;
  templates?: Jsdoc<'template'>[];
  params?: Jsdoc<'param'>[];
  /** Return type as GML typestring */
  returns?: Jsdoc<'returns'>;
  /** Parameter or variable name */
  name?: JsdocComponent;
  /** If is an optional param */
  optional?: boolean;
  /** The GML typestring, for use by a param, type, localvar, etc */
  type?: JsdocComponent;
  /** For functions or self docs, the GML typestring for an @self/@context */
  self?: JsdocComponent;
}

export interface JsdocSummary
  extends Jsdoc<
    | 'description'
    | 'function'
    | 'type'
    | 'self'
    | 'globalvar'
    | 'instancevar'
    | 'localvar'
  > {
  /**
   * The list of all tags found in this block, and their
   * respective locations, for use e.g. syntax highlighting.
   */
  tags: JsdocComponent[];
  diagnostics: (IRange & { message: string })[];
  /** Locations of all of the types parsed from the JSDoc block */
  typeRanges: JsdocComponent[];
}

interface JsdocLine {
  content: string;
  start: IPosition;
}

/**
 * Given an IToken containing an entire JSDoc block,
 * convert it to a list of lines, each with its own position.
 */
function jsdocBlockToLines(raw: {
  image: string;
  startLine?: number;
  startColumn?: number;
  startOffset: number;
}): JsdocLine[] {
  raw = { ...raw }; // Clone so we don't mutate the original
  const startPosition: IPosition = {
    line: raw.startLine!,
    column: raw.startColumn!,
    offset: raw.startOffset,
  };
  // If this starts with a /**, remove that.
  raw.image = raw.image.replace(/^\/\*\*/, '   ');
  // If this ends with a */, remove that.
  raw.image = raw.image.replace(/\*\/$/, '  ');

  const rawLines = raw.image.split(/(\r?\n)/);
  const jsdocLines: JsdocLine[] = [];

  let jsdocLine: JsdocLine = {
    content: '',
    start: startPosition,
  };
  for (let l = 0; l < rawLines.length; l++) {
    const line = rawLines[l];
    if (!line) continue;
    if (line.match(/\r?\n/)) {
      // Then we need to add more space to the current jsdocline
      // start position
      jsdocLine.start.line++;
      jsdocLine.start.column = 1;
      jsdocLine.start.offset += line.length;
      continue;
    }
    jsdocLine.content += line;
    jsdocLines.push(jsdocLine);
    // Create the next jsdoc line
    jsdocLine = {
      content: '',
      start: {
        line: jsdocLine.start.line,
        column: jsdocLine.start.column + line.length,
        offset: jsdocLine.start.offset + line.length,
      },
    };
  }
  return jsdocLines;
}

/**
 * Given an array of ITokens, each containing a single line
 * from a block of ///-style JSDoc comments, convert it to
 * a common format.
 */
function jsdocGmlToLines(raw: IToken[]): JsdocLine[] {
  // We already have lines as required, so just convert formats
  return raw.map((token) => ({
    content: token.image,
    start: {
      line: token.startLine!,
      column: token.startColumn!,
      offset: token.startOffset,
    },
  }));
}

/**
 * Given a raw string containing a JSDoc block in either GML
 * or JS style, convert it
 * to a list of lines, each with its own position.
 */
function jsdocStringToLines(
  raw: string,
  startPosition?: IPosition,
): JsdocLine[] {
  const asIToken = {
    image: raw,
    startLine: startPosition?.line || 1,
    startColumn: startPosition?.column || 1,
    startOffset: startPosition?.offset || 0,
  };
  return jsdocBlockToLines(asIToken);
}

/**
 * Since single-line style comments make it impossible to
 * tell when we're in a NEW doc, we need to break lines into
 * groups
 */
export function gmlLinesByGroup(gmlLines: IToken[]): JsdocLine[][] {
  const lines = jsdocGmlToLines(gmlLines);
  const groups: JsdocLine[][] = [[]];
  let currentGroup = groups[0];
  lines: for (const line of lines) {
    if (!line) {
      continue;
    }
    let match: RegExpMatchArray | null = null;
    for (const tagName of names) {
      match = line.content.match(regexes[tagName]) as RegExpMatchArray;
      if (!match) {
        continue;
      }
      const parts = match.groups as MatchGroups;
      // Consider simpler groups and let the rest fall together
      if (parts.localvar || parts.globalvar || parts.instancevar) {
        // Then this is a new block!
        currentGroup = [];
        groups.push(currentGroup);
      }
      currentGroup.push(line);
      continue lines; // Matches are exclusive, so go to the next line
    }
    // If we make it here then we didn't fine a match. Just add it to the currentgruop
    currentGroup.push(line);
  }
  return groups.filter((g) => g.length);
}

export function parseJsdoc(jsdocLines: JsdocLine[]): JsdocSummary;
export function parseJsdoc(gmlLines: IToken[]): JsdocSummary;
export function parseJsdoc(jsBlock: IToken): JsdocSummary;
export function parseJsdoc(
  jsdocString: string,
  /**
   * The position of the first character of the jsdoc string,
   * if it has been parsed out of a larger document. This is
   * used to offset the positions of discovered tag components.
   */
  startPosition?: IPosition,
): JsdocSummary;
export function parseJsdoc(
  raw: string | IToken | IToken[] | JsdocLine[],
  /**
   * The position of the first character of the jsdoc string,
   * if it has been parsed out of a larger document. This is
   * used to offset the positions of discovered tag components.
   */
  startPosition?: IPosition,
): JsdocSummary | undefined {
  let lines: JsdocLine[];
  if (typeof raw === 'string') {
    lines = jsdocStringToLines(raw, startPosition);
  } else if (Array.isArray(raw)) {
    if (raw[0] && 'image' in raw[0]) {
      // Then this is a list of ITokens
      lines = jsdocGmlToLines(raw as IToken[]);
    } else {
      // Then this is a list of JsdocLines
      lines = raw as JsdocLine[];
    }
  } else {
    // Then this is a single IToken
    lines = jsdocBlockToLines(raw as IToken);
  }
  assert(lines, 'Lines must be an array');
  if (!lines.length) return undefined;
  assert(lines[0], 'No lines found in jsdoc block');
  const start: IPosition = lines[0].start;
  const end: IPosition = { ...lines.at(-1)!.start };
  end.column += lines.at(-1)!.content.length;
  end.offset += lines.at(-1)!.content.length;

  // Default to a description-only doc, and update its type
  // if we can infer it based on the tags.
  const doc: JsdocSummary = {
    kind: 'description',
    description: '',
    start,
    end,
    tags: [],
    diagnostics: [],
    typeRanges: [],
  };

  const addTypeRanges = (component: JsdocComponent | undefined) => {
    if (!component) return;
    const types = flattenFeatherTypes(component.content);
    for (const type of types) {
      // Convert the offset to a range and add it to typeRanges
      const start = {
        line: component.start.line,
        column: component.start.column + type.name.offset,
        offset: component.start.offset + type.name.offset,
      };
      const end = { ...start };
      end.column += type.name.content.length - 1;
      end.offset += type.name.content.length - 1;
      doc.typeRanges.push({
        content: type.name.content,
        start,
        end,
      });
    }
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

  for (const line of lines) {
    assert(line, 'Line does not exist');
    // Check for a match against each of the tag patterns
    // until we fined one. If we don't then `match` will
    // stay null, and we can use the line as a description.
    let match: RegExpMatchArray | null = null;
    for (const tagName of names) {
      match = line.content.match(regexes[tagName]) as RegExpMatchArray;
      const parts = match?.groups as MatchGroups;
      // TODO: In Node <18, this will be undefined. Once VSCode
      // updates to use Node 18+ we can remove the `undefined` union.
      // const indices = match?.indices?.groups as MatchIndices | undefined;
      if (!match) {
        // Then we haven't found a tag yet
        continue;
      }
      // Add the tag to the list of tags
      const tagMatch = line.content.match(/@\w+\b/)!;
      assert(tagMatch, 'Tag match should exist');
      assert(tagMatch[0], 'Tag match must be an array');
      const tagIndices = [
        tagMatch.index!,
        tagMatch.index! + tagMatch[0].length,
      ] as const;
      doc.tags.push({
        content: parts.tag!,
        ...matchIndexToRange(line.start, tagIndices),
      });

      // Based on the tag type, update the doc
      const impliesFunction =
        parts.function ||
        parts.param ||
        parts.returns ||
        parts.pure ||
        parts.template;
      if (impliesFunction) {
        doc.kind = 'function';
      }

      const matchIndices = [
        match.index!,
        match.index! + match[0].length,
      ] as const;
      const entireMatchRange = matchIndexToRange(line.start, matchIndices);

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
      // Handle params, templates, and variables
      else if (
        parts.param ||
        parts.template ||
        parts.localvar ||
        parts.globalvar ||
        parts.instancevar
      ) {
        // Until VSCode ships Node 18, and therefore has group
        // indices, we'll have to get positions with a simple search
        // per group.
        const kind = parts.param
          ? 'param'
          : parts.template
          ? 'template'
          : parts.localvar
          ? 'localvar'
          : parts.globalvar
          ? 'globalvar'
          : 'instancevar';

        const typeString = substringRange(
          line.content,
          parts.typeUnion,
          line.start,
        );
        addTypeRanges(typeString);

        const entity: Jsdoc<typeof kind> = {
          kind,
          name: substringRange(
            line.content,
            parts.name || parts.optionalName!,
            line.start,
          ),
          optional: !!parts.optionalName,
          type: typeString,
          description: parts.info || '',
          ...entireMatchRange,
        };
        if (kind === 'param') {
          doc.params = doc.params || [];
          doc.params.push(entity as Jsdoc<'param'>);
        } else if (kind === 'template') {
          doc.templates = doc.templates || [];
          doc.templates.push(entity as Jsdoc<'template'>);
        } else {
          doc.kind = kind;
          doc.type = entity.type;
          doc.name = entity.name;
          doc.description = entity.description;
        }
        // Update the current describing object in case the next line is a description
        describing = entity;
      }
      // Handle returns
      else if (parts.returns) {
        if (doc.returns) {
          // Then we don't want to overwrite.
          break;
        }
        const typeString = substringRange(
          line.content,
          parts.typeUnion!,
          line.start,
        );
        addTypeRanges(typeString);

        const returns: Jsdoc<'returns'> = {
          kind: 'returns',
          type: typeString,
          description: parts.info || '',
          ...entireMatchRange,
        };
        doc.returns = returns;
        // Update the current describing object in case the next line is a description
        describing = returns;
      }
      // Handle Self
      else if (parts.self) {
        doc.self = substringRange(line.content, parts.type!, line.start);
        addTypeRanges(doc.self);
        if (parts.extraBracket) {
          doc.diagnostics.push({
            message: '@self types should not be wrapped in brackets',
            start: doc.self!.start,
            end: doc.self!.end,
          });
        }
      }
      // Handle Type
      else if (parts.type) {
        doc.kind = 'type';
        doc.type = substringRange(line.content, parts.typeUnion!, line.start);
        addTypeRanges(doc.type);
        doc.description = appendDescription(doc.description, parts.info);
      }
      // Handle modifiers
      else if (parts.deprecated) {
        doc.deprecated = true;
      } else if (parts.ignore) {
        doc.ignore = true;
      } else if (parts.mixin) {
        doc.mixin = true;
      }
      break;
    }
    // If we haven't found a tag, then this is a description line
    // Then this is a description-only line (or something invalid).
    // Apply it to the current describing object.
    if (!match && describing) {
      const descriptionMatch = line.content.match(descriptionLine);
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

  // Ensure that there are no redundantly-named params, since that
  // is both not allowed and likely to cause weird problems later.
  // The safest thing to do if we see a duplicate is to skip it and all
  // subsequent params.
  const paramNames = new Set<string>();
  for (let i = 0; i < (doc.params?.length || 0); i++) {
    const param = doc.params![i];
    if (paramNames.has(param.name!.content)) {
      doc.diagnostics.push({
        message: `Duplicate param name: ${param.name!.content}`,
        start: param.name!.start,
        end: param.name!.end,
      });
      // Add diagnostics for all subsequent params
      for (let j = i + 1; j < doc.params!.length; j++) {
        const laterParam = doc.params![j];
        doc.diagnostics.push({
          message: `Skipping due to previous duplicate param`,
          start: laterParam.name!.start,
          end: laterParam.name!.end,
        });
      }
      doc.params!.splice(i);
      break;
    }
    paramNames.add(param.name!.content);
  }

  return doc;
}

function substringRange(
  string: string,
  substring: string | undefined,
  start: IPosition,
): JsdocComponent | undefined {
  if (!substring) {
    return undefined;
  }
  start = { ...start };
  const index = string.indexOf(substring);
  if (index < 0) {
    return undefined;
  }
  start.column += index;
  start.offset += index;
  return {
    start,
    end: {
      column: start.column + substring.length - 1,
      line: start.line,
      offset: start.offset + substring.length - 1,
    },
    content: substring,
  };
}

function matchIndexToRange(
  startPosition: IPosition,
  index: MatchIndex | undefined,
): IRange {
  // Note that the IRange uses column and line indexes that start at 1, while the offset starts at 0.
  const range: IRange = {
    start: { ...startPosition },
    end: { ...startPosition },
  };
  range.start.column += index?.[0] || 0;
  range.start.offset += index?.[0] || 0;
  range.end.column += index?.[1] || 0;
  range.end.offset += index?.[1] || 0;
  return range;
}
