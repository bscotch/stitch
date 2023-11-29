import { z } from 'zod';
import { createBsArrayKey } from './helpers.js';
import { Crashlands2 } from './types.cl2.js';
import { Position, Range } from './types.editor.js';
import { Mote } from './types.js';

export type ParsedLine = {
  [K in keyof LineParts | '_']?: {
    start: Position;
    end: Position;
    value: K extends keyof LineParts ? LineParts[K] : string;
  };
};

type CompletionsData =
  | {
      type: 'motes';
      options: Mote[];
    }
  | {
      type: 'labels';
      options: Set<string>;
    }
  | {
      type: 'booleans';
      options: ['true', 'false'];
    }
  | {
      type: 'momentStyles';
      options: string[];
    };

export interface ParsedClue {
  /** arrayId */
  id: string | undefined;
  /** Speaker MoteId */
  speaker: string | undefined;
  phrases: {
    /** arrayId */
    id: string | undefined;
    /** MoteId for the Emoji */
    emoji?: string;
    text: string;
  }[];
}

export interface ParsedEmote {
  /** arrayId */
  id: string | undefined;
  /** MoteId for the Emoji */
  emoji: string | undefined;
  /** MoteId for the speaker */
  speaker: string | undefined;
}

export interface ParsedEmoteGroup {
  kind: 'emote';
  /** arrayId */
  id: string | undefined;
  emotes: ParsedEmote[];
}

export interface ParsedOtherMoment {
  kind: 'other';
  id: string | undefined;
  style: string | undefined;
}

export interface ParsedDialog {
  kind: 'dialogue';
  /** arrayId */
  id: string | undefined;
  speaker: string | undefined;
  /** MoteId for the Emoji */
  emoji?: string;
  text: string;
}

export interface ParsedComment {
  /** arrayId */
  id: string | undefined;
  text: string | undefined;
}

type ParsedMoment = ParsedEmoteGroup | ParsedDialog | ParsedOtherMoment;

export interface QuestUpdateResult {
  diagnostics: (Range & { message: string })[];
  hovers: (Range & { title?: string; description?: string })[];
  edits: (Range & { newText: string })[];
  completions: (Range & CompletionsData)[];
  parsed: {
    name?: string;
    /** The moteId for the storyline */
    storyline?: string;
    /** The moteId for the quest giver */
    quest_giver?: string;
    /** The moteId for the quest receiver */
    quest_receiver?: string;
    clues: ParsedClue[];
    quest_start_log?: string;
    quest_start_moments: ParsedMoment[];
    quest_end_moments: ParsedMoment[];
    draft?: boolean;
    comments: ParsedComment[];
  };
}

export type Section = (typeof sections)[number];
export const sections = ['start moments', 'end moments'] as const;

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
});

export const arrayTagPattern = '(?:#(?<arrayTag>[a-z0-9]+))';
const moteTagPattern = '(?:@(?<moteTag>[a-z0-9_]+))';
const moteNamePattern = "(?<moteName>[A-Za-z0-9:&?! ',()-]+)";
const emojiGroupPattern = '(?<emojiGroup>\\(\\s*(?<emojiName>[^)]*?)\\s*\\))';

export const linePatterns = [
  /** Label:Text */
  `^(?<labelGroup>(?<label>Name|Log|Draft)\\s*:)\\s*(?<text>.*?)\\s*$`,
  /** Labeled Mote */
  `^(?<labelGroup>(?<label>[\\w ]+)${arrayTagPattern}?\\s*:)\\s*(${moteNamePattern}${moteTagPattern}?)?\\s*$`,
  /** Dialogue Speaker */
  `^(?<indicator>\\t)(${moteNamePattern}${moteTagPattern}?)?\\s*$`,
  /** Dialogue Text */
  `^(?<indicator>>)\\s*?${arrayTagPattern}?(\\s+${emojiGroupPattern}?(\\s*(?<text>.*)))?\\s*$`,
  /** Comment Line */
  `^(?<indicator>//)\\s*?${arrayTagPattern}?\\s*(?<text>.*?)\\s*$`,
  /** Emote Declaration */
  `^(?<indicator>:\\))\\s*${arrayTagPattern}?\\s*$`,
  /** Emote */
  `^(?<indicator>!)\\s*?${arrayTagPattern}?(?<sep>\\s+)(${moteNamePattern}${moteTagPattern}\\s+${emojiGroupPattern})?\\s*$`,
  /** Non-Dialog Moment */
  `^(?<indicator>\\?)\\s*?${arrayTagPattern}?(?<sep>\\s+)(?<style>.*?)?\\s*$`,
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

export type Label = keyof typeof labels;
const labels = {
  name() {
    return ['name'];
  },
  storyline() {
    return ['storyline'];
  },
  draft() {
    return ['wip', 'draft'];
  },
  '//'(tag?: string) {
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
  'start moments'() {
    return ['quest_start_moments'];
  },
  'end moments'() {
    return ['quest_end_moments'];
  },
} satisfies {
  [prefix: string]: (
    extra: string,
    section: Section,
  ) => [keyof Crashlands2.Quest, ...string[]];
};

export function lineIsArrayItem(line: string): boolean {
  if (
    line.match(
      /^(\t|name|draft|storyline|(start|end) moments|log|giver|receiver)/i,
    )
  ) {
    return false;
  }
  return true;
}

export function getPointerForLabel(
  label: string,
  arrayTag: string | undefined,
  section: Section | undefined,
): string[] | null {
  label = label.toLowerCase();
  if (label in labels) {
    return labels[label as keyof typeof labels](arrayTag!);
  }
  return null;
}
