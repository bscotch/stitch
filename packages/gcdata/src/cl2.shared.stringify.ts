import { assert } from './assert.js';
import type { GameChanger } from './GameChanger.js';
import { toMoteTag } from './helpers.js';

export function emojiString(emojiId: string | undefined, packed: GameChanger) {
  if (!emojiId) return '';
  const emoji = packed.working.getMote(emojiId);
  const name = packed.working.getMoteName(emoji) || emoji?.id || 'UNKNOWN';
  return name ? `(${name})` : '';
}

export function characterString(characterId: string, packed: GameChanger) {
  assert(characterId, 'Character ID must be defined');
  const character = packed.working.getMote(characterId);
  const name =
    packed.working.getMoteName(character) || character?.id || 'UNKNOWN';
  return name ? `${name.toUpperCase()}${toMoteTag(characterId)}` : '';
}
