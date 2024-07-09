import { z } from 'zod';
import type { Gcdata } from './GameChanger.js';
import { assert } from './assert.js';
import type { ParsedLine } from './cl2.quest.types.js';
import type { Crashlands2 } from './cl2.types.auto.js';
import type { ParsedBase, ParserResult } from './cl2.types.editor.js';
import type { Position, Range } from './types.editor.js';
import type { BschemaRoot, Mote } from './types.js';

export const storylineSchemaId = 'cl2_storyline';

export type StorylineData = Crashlands2.Schemas['cl2_storyline'];
export type StorylineMote = Mote<StorylineData>;

type CompletionsData =
  | { type: 'glossary'; options: string[] }
  | { type: 'stages'; options: string[] }
  | { type: 'labels'; options: Set<string> };
export interface StorylineUpdateResult extends ParserResult {
  parsed: ParsedBase & {
    description?: string;
  };
  completions: (Range & CompletionsData)[];
}

export function listStorylines(gcData: Gcdata): StorylineMote[] {
  return gcData.listMotesBySchema<StorylineData>(storylineSchemaId);
}

export function isStorylineMote(mote: any): mote is StorylineMote {
  return mote.schema_id === storylineSchemaId;
}

export function getStorylineMote(
  gcData: Gcdata,
  moteId: string,
): StorylineMote | undefined {
  const mote = gcData.getMote<StorylineData>(moteId);
  assert(!mote || isStorylineMote(mote), `Mote ${moteId} is not a storyline`);
  return mote;
}

export function getStorylineMotes(gcData: Gcdata): StorylineMote[] {
  const motes = gcData.listMotesBySchema<StorylineData>(storylineSchemaId);
  return motes;
}

export function getStorylineSchema(gcData: Gcdata): BschemaRoot | undefined {
  return gcData.getSchema(storylineSchemaId) as BschemaRoot;
}

// PATTERNS
// Note: These patterns are defined so that they'll work on partial lines
// as much as possible, so their group names should always be checked for existence.
const linePartsSchema = z.object({
  indicator: z
    .string()
    .optional()
    .describe(
      'The symbol prefixing the line to indicate what the line type is',
    ),
  arrayTag: z
    .string()
    .regex(/^[a-z0-9]+$/)
    .optional()
    .describe("BsArrayElement identifier (without the '#' prefix)"),
  labelGroup: z.string().optional().describe('The label, including the `:`'),
  label: z.string().optional().describe('For `Label:Value` elements'),
  text: z
    .string()
    .optional()
    .describe('For dialog and similar, the text content'),
});

export const arrayTagPattern = '(?:#(?<arrayTag>[a-z0-9]+))';

export const linePatterns = [
  /** Label:Text */
  `^(?<labelGroup>(?<label>Name|Description|Stage)\\s*:)\\s*(?<text>.*?)\\s*$`,
  /** Comment Line */
  `^(?<indicator>//)\\s*?${arrayTagPattern}?\\s*(?<text>.*?)\\s*$`,
];

export function parseIfMatch(
  pattern: string,
  line: string,
  startPosition: Position,
): ParsedLine | null {
  const rawMatch = line.match(new RegExp(pattern));
  if (!rawMatch) return null;

  const parsedLine = linePartsSchema.parse(rawMatch.groups!);

  const result: ParsedLine = {
    _: {
      start: startPosition,
      end: { ...startPosition },
      value: line,
    },
  };
  result._!.end.character += line.length;
  result._!.end.index += line.length;
  for (const [key, value] of Object.entries(parsedLine)) {
    if (typeof value !== 'undefined') {
      // Figure out where this is in the matches so we
      // can get the start and end positions.
      const startChar = line.indexOf(`${value}`);
      const endChar = startChar + `${value}`.length;
      const start = { ...startPosition };
      start.character += startChar;
      start.index += startChar;
      const end = { ...startPosition };
      end.character += endChar;
      end.index += endChar;
      result[key as keyof ParsedLine] = {
        start,
        end,
        value: value as any,
      } as any;
    }
  }
  return result;
}

export function lineIsArrayItem(line: string): boolean {
  return /^\/\//.test(line);
}
