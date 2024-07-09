import {
  getEmojis,
  getStagingOptions,
  ParserResult,
} from './cl2.shared.types.js';
import type { GameChanger } from './GameChanger.js';
import { ParsedLineItem } from './types.editor.js';
import { checkWords } from './util.js';

export function prepareParserHelpers(
  text: string,
  packed: GameChanger,
  options: {
    checkSpelling?: boolean;
  } = {},
  result: ParserResult<any>,
) {
  /** Terms from the glossary for use in autocompletes */
  const glossaryTerms = (packed.glossary?.relevantTerms() || []).map(
    (t) => t.text,
  );

  const checkSpelling = (item: ParsedLineItem<any> | undefined) => {
    if (!item || !options.checkSpelling || !packed.glossary) return;
    result.words.push(...checkWords(item, packed.glossary));
  };

  const lines = text.split(/(\r?\n)/g);

  const stagingOptions = getStagingOptions(packed.working);
  const emojis = getEmojis(packed.working);
  const emojiIdFromName = (name: string | undefined): string | undefined => {
    if (!name) {
      return undefined;
    }
    const emoji = emojis.find(
      (e) =>
        packed.working.getMoteName(e)?.toLowerCase() ===
          name?.trim().toLowerCase() || e.id === name?.trim(),
    );
    return emoji?.id;
  };

  return {
    glossaryTerms,
    stagingOptions,
    emojis,
    emojiIdFromName,
    checkSpelling,
    lines,
    index: 0,
    lineNumber: 0,
  };
}
