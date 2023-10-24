import { z } from 'zod';
import { createBsArrayKey } from './helpers.js';
import { Crashlands2 } from './types.cl2.js';
import { Position } from './types.editor.js';

export type ParsedLine = {
  [K in keyof LineParts | '_']?: {
    start: Position;
    end: Position;
    value: K extends keyof LineParts ? LineParts[K] : string;
  };
};

// PATTERNS
// Note: These patterns are defined so that they'll work on partial lines
// as much as possible, so their group names should always be checked for existence.
type LineParts = z.output<typeof linePartsSchema>;
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
  label: z.string().optional().describe('For `Label:Value` elements'),
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
  count: z
    .string()
    .optional()
    .describe('Numeric value indicating a count')
    .transform((x) => (typeof x === 'string' ? parseInt(x, 10) : undefined)),
  rest: z
    .string()
    .optional()
    .describe(
      'For complex elements that need to be further parsed later, the rest of the line',
    ),
});

const arrayTagPattern = '(?:#(?<arrayTag>[a-z0-9]+))';
const moteTagPattern = '(?:@(?<moteTag>[a-z0-9_]+))';
const moteNamePattern = "(?<moteName>[A-Za-z0-9 '-]+)";
const emojiGroupPattern = '(?<emojiGroup>\\(\\s*(?<emojiName>[^)]+?)\\)\\s*)';

export const linePatterns = [
  /** Labeled Line */
  `^(?<label>[\\w -]+)${arrayTagPattern}?\\s*:\\s*(?<rest>.*)?$`,
  /** Dialogue Speaker */
  `^(?<indicator>\\t)(${moteNamePattern}${moteTagPattern}?)?`,
  /** Dialogue Text */
  `^(?<indicator>>)\\s*?${arrayTagPattern}?(\\s+${emojiGroupPattern}?(?<text>.*))?$`,
  /** Objective */
  `^(?<indicator>-)\\s*?${arrayTagPattern}?(\\s+(?<style>[\\w -]+))?$`,
  /** Emote Declaration */
  `^(?<indicator>:\\))\\s*${arrayTagPattern}?`,
  /** Emote */
  `^(?<indicator>!)\\s*?${arrayTagPattern}?(\\s+${moteNamePattern}${moteTagPattern}\\s+${emojiGroupPattern})?`,
  /** Add Item */
  `^(?<indicator>\\+)((?<count>\\d+)\\s+${moteNamePattern}${moteTagPattern})?`,
  /** Requirement */
  `^(?<indicator>\\?)\\s*?${arrayTagPattern}?((\\s+(?<style>[\\w -]+))(:\\s*(?<rest>.*))?)?$`,
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

export type Section = keyof typeof pointers;
const pointers = {
  name() {
    return ['name'];
  },
  storyline() {
    return ['storyline'];
  },
  draft() {
    return ['wip', 'draft'];
  },
  note(tag?: string) {
    return ['wip', 'comments', tag || createBsArrayKey()];
  },
  giver() {
    return ['quest_giver', 'item'];
  },
  receiver() {
    return ['quest_receiver', 'item'];
  },
  log() {
    return ['quest_start_log', 'text'];
  },
  clue(tag?: string) {
    return ['clues', tag || createBsArrayKey()];
  },
  objectives() {
    return ['objectives'];
  },
  'start requirements'() {
    return ['quest_start_requirements'];
  },
  'start moments'() {
    return ['quest_start_moments'];
  },
  'end requirements'() {
    return ['quest_end_requirements'];
  },
  'end moments'() {
    return ['quest_end_moments'];
  },
  '\t'(when: string) {
    return [`quest_${when as 'start' | 'end'}_moments`, 'anykey'];
  },
} satisfies {
  [prefix: string]: (extra: string) => [keyof Crashlands2.Quest, ...string[]];
};

export function lineIsArrayItem(line: string): boolean {
  if (
    line.match(
      /^(\t|!|\+|name|draft|storyline|(start|end) (requirements|moments)|objectives|log|giver|receiver)/i,
    )
  ) {
    return false;
  }
  return true;
}

export function getPointerForLabel(
  label: string,
  arrayTag: string | undefined,
): string[] | null {
  label = label.toLowerCase();
  if (label in pointers) {
    return pointers[label as keyof typeof pointers](arrayTag!);
  }
  return null;
}
