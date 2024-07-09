import { z } from 'zod';
import { assert } from './assert.js';
import type { Crashlands2 } from './cl2.types.auto.js';
import type { Gcdata } from './GameChanger.js';
import type {
  ParsedLineItem,
  ParsedWord,
  Position,
  Range,
} from './types.editor.js';
import type { BschemaEnum, Mote } from './types.js';
import { resolvePointerInSchema } from './util.js';

export interface ParsedComment {
  /** arrayId */
  id: string | undefined;
  text: string | undefined;
}

export interface ParsedBase {
  name?: string;
  stage?: Crashlands2.Staging;
  comments: ParsedComment[];
}

export interface ParserResult<P extends Record<string, any>> {
  diagnostics: (Range & { message: string })[];
  hovers: (Range & { title?: string; description?: string })[];
  edits: (Range & { newText: string })[];
  completions: (Range & CompletionsData)[];
  words: ParsedWord[];
  parsed: ParsedBase & P;
}

export type CompletionsData =
  | {
      type: 'motes';
      options: Mote[];
    }
  | {
      type: 'labels';
      options: Set<string>;
    }
  | {
      type: 'stages';
      options: Crashlands2.Staging[];
    }
  | {
      type: 'booleans';
      options: ['true', 'false'];
    }
  | {
      type: 'momentStyles';
      options: string[];
    }
  | {
      type: 'requirementStyles';
      options: string[];
    }
  | { type: 'glossary'; options: string[] };

export type ParsedLine = {
  [K in keyof LineParts]?: ParsedLineItem<LineParts[K]>;
} & {
  _: {
    start: Position;
    end: Position;
    value: string;
  };
};

export const arrayTagPattern = '(?:#(?<arrayTag>[a-z0-9]+))';

// PATTERNS
// Note: These patterns are defined so that they'll work on partial lines
// as much as possible, so their group names should always be checked for existence.
export type LineParts = z.output<typeof linePartsSchema>;
export const linePartsSchema = z.object({
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
  moteTag: z
    .string()
    .regex(/^[\w_-]+$/)
    .optional()
    .describe("MoteId (without the '@' prefix)"),
  moteName: z.string().optional().describe('Mote Name'),
  emojiGroup: z
    .string()
    .optional()
    .describe('The emoji name, including the outer `()`'),
  emojiName: z.string().optional().describe("The emoji's mote name"),
  labelGroup: z.string().optional().describe('The label, including the `:`'),
  label: z.string().optional().describe('For `Label:Value` elements'),
  sep: z
    .string()
    .optional()
    .describe('Separator between the line prefix and content.'),
  text: z
    .string()
    .optional()
    .describe('For dialog and similar, the text content'),
  style: z
    .string()
    .optional()
    .describe(
      'For array elements whose values come in distinct flavors, the identifier indicating which flavor it is',
    ),
  status: z
    .string()
    .optional()
    .describe('For entries that have some kind of "status" concept'),
});

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
  if (
    line.match(
      /^(\t|name|stage|storyline|(start|end) (moments|requirements)|log|giver|receiver|description)/i,
    )
  ) {
    return false;
  }
  return true;
}

export function getStagingOptions(packed: Gcdata): Crashlands2.Staging[] {
  const stagingSubchema = resolvePointerInSchema(
    ['wip', 'staging'],
    {
      schema_id: 'cl2_quest',
      data: {
        wip: {
          staging: 'any',
        },
      },
    } as any,
    packed,
  ) as BschemaEnum;
  return stagingSubchema.enum;
}

export function getEmojis(
  packed: Gcdata,
): Mote<Crashlands2.Schemas['cl2_emoji']>[] {
  const emojis =
    packed.listMotesBySchema<Crashlands2.Schemas['cl2_emoji']>('cl2_emoji');
  assert(emojis.length > 0, 'Should have at least one emoji mote');
  return emojis;
}
