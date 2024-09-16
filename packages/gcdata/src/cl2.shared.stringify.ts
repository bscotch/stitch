import { assert } from './assert.js';
import type { GameChanger } from './GameChanger.js';
import { toMoteTag } from './helpers.js';

export function emojiString(
  emojiId: string | undefined | { emoji?: string } | { emotion?: string },
  packed: GameChanger,
): string {
  if (!emojiId) return '';
  let id: string;
  if (typeof emojiId === 'string') id = emojiId;
  else if ('emoji' in emojiId) id = emojiId.emoji || '';
  else if ('emotion' in emojiId) id = emojiId.emotion || '';
  else {
    return '';
  }
  const emoji = packed.working.getMote(id);
  const name = packed.working.getMoteName(emoji) || emoji?.id || 'UNKNOWN';
  return name ? `(${name})` : '';
}

export function characterString(
  characterId: string,
  packed: GameChanger,
): string {
  assert(characterId, 'Character ID must be defined');
  const character = packed.working.getMote(characterId);
  const name =
    packed.working.getMoteName(character) || character?.id || 'UNKNOWN';
  return name ? `${name.toUpperCase()}${toMoteTag(characterId)}` : '';
}
