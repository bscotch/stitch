import type { Crashlands2 } from './types.cl2.js';
import type { Mote } from './types.js';

export interface BsArrayItem {
  /** The element's content */
  element?: unknown;
  /** The order in which this element appears in the array */
  order?: number;
}

/** Get an array, in proper sort order, from a BschemaArray object */
export function bsArrayToArray<
  T extends {
    [k: string]: BsArrayItem;
  },
>(
  bsArray: T,
): {
  [K in keyof T]: { id: K; order: number; element: T[K]['element'] };
}[keyof T][] {
  if (!bsArray) return [];
  return Object.entries(bsArray)
    .map(([id, item]) => ({
      id,
      order: item.order ?? 0,
      element: item.element,
    }))
    .sort((a, b) => a.order - b.order);
}

export function isQuestMote(mote: any): mote is Mote<Crashlands2.Quest> {
  return mote.schema_id === 'cl2_quest';
}

export function isStorylineMote(
  mote: any,
): mote is Mote<Crashlands2.Storyline> {
  return mote.schema_id === 'cl2_storyline';
}

/**
 * Create a four-character, consonumeric key for a BschemaArray item.
 */
export function createBsArrayKey(length = 4) {
  const characters = 'bcdfghjklmnpqrstvwxyz0123456789';
  let key = '';
  for (let i = 0; i < length; i++) {
    key += characters[Math.floor(Math.random() * characters.length)];
  }
  return key;
}
