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

export type CharacterData = BuddyData | NpcData;
export type CharacterMote = BuddyMote | NpcMote;
export type JuiceboxData = Crashlands2.Schemas['cl2_juicebox'];
export type JuiceboxMote = Mote<JuiceboxData>;
export type FluxData = Crashlands2.Schemas['cl2_player'];
export type FluxMote = Mote<FluxData>;

export const questSchemaId = 'cl2_quest';
export type QuestData = Crashlands2.Schemas['cl2_quest'];
export type QuestMote = Mote<QuestData>;

export const chatSchemaId = 'cl2_chat';
export type ChatData = Crashlands2.Schemas['cl2_chat'];
export type ChatMote = Mote<ChatData>;

export const buddySchemaId = 'artisan';
export type BuddyData = Crashlands2.Schemas['artisan'];
export type BuddyMote = Mote<BuddyData>;

export const npcSchemaId = 'cl2_npc';
export type NpcData = Crashlands2.Schemas['cl2_npc'];
export type NpcMote = Mote<NpcData>;

export const comfortSchemaId = 'cl2_artisan_glads';
export type ComfortData = Crashlands2.Schemas['cl2_artisan_glads'];
export type ComfortMote = Mote<ComfortData>;

export const storylineSchemaId = 'cl2_storyline';
export type StorylineData = Crashlands2.Schemas['cl2_storyline'];
export type StorylineMote = Mote<StorylineData>;

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
  _hadArrayTag?: boolean;
};

export const arrayTagPattern = '(?:#(?<arrayTag>[a-z0-9]+))';
export const emojiGroupPattern =
  '(?<emojiGroup>\\(\\s*(?<emojiName>[^)]*?)\\s*\\))';
export const moteTagPattern = '(?:@(?<moteTag>[a-z0-9_]+))';
export const moteNamePattern = "(?<moteName>[A-Za-z0-9:&?! ',()/-]+)";
export const dialogPattern = `^(?<indicator>>)\\s*?${arrayTagPattern}?(\\s+${emojiGroupPattern}?(\\s*(?<text>.*)))?\\s*$`;
export const commentLinePattern = `^(?<indicator>//)\\s*?${arrayTagPattern}?\\s*(?<text>.*?)\\s*$`;

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
  arrayTag2: z
    .string()
    .regex(/^[a-z0-9]+$/)
    .optional()
    .describe(
      "BsArrayElement identifier (without the '#' prefix), in the case that there are >1 in a line",
    ),
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

export function lineIsArrayItem(line: string, schemaId: string): boolean {
  // Shared non-array types:
  if (line.match(/^(name|stage|description)/i)) {
    return false;
  }
  // Quest & Story specific non-array types:
  else if ([questSchemaId, storylineSchemaId].includes(schemaId)) {
    return !line.match(
      /^(\t|storyline|(start|end) (moments|requirements)|log|giver|receiver|unlocked description)/i,
    );
  } else if ([buddySchemaId, npcSchemaId].includes(schemaId)) {
    return !line.match(/^(idle dialogue)/i);
  } else if (schemaId === chatSchemaId) {
    // These are weird, so should be handled outside the automated systems
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

/**
 * List all character motes in the game, including Flux and Juicebox.
 */
export function listAllCharacters(
  gcData: Gcdata,
): (CharacterMote | FluxMote | JuiceboxMote)[] {
  return gcData.listMotesBySchema(
    npcSchemaId,
    buddySchemaId,
    'cl2_player',
    'cl2_juicebox',
  ) as any;
}
