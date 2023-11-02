import type { Crashlands2 } from './types.cl2.js';
import { Position } from './types.editor.js';
import type { BschemaBsArray, BschemaObject, Mote } from './types.js';

export interface BsArrayItem {
  /** The element's content */
  element?: unknown;
  /** The order in which this element appears in the array */
  order?: number;
}

export type BsArray = {
  [k: string]: BsArrayItem;
};

/** Get an array, in proper sort order, from a BschemaArray object */
export function bsArrayToArray<T extends BsArray>(
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

export function isObjectSchema(schema: any): schema is BschemaObject {
  return (
    !!schema &&
    !!(
      schema.type === 'object' ||
      schema.properties ||
      schema.additionalProperties
    )
  );
}

export function isBsArraySchema(schema: any): schema is BschemaBsArray {
  return (
    isObjectSchema(schema) && 'format' in schema && schema.format === 'bsArray'
  );
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

export function changedPosition(
  start: Position,
  change: { characters: number },
) {
  const position = { ...start };
  if (change.characters < 0 && position.character < -change.characters) {
    position.index -= position.character;
    position.character = 0;
  } else {
    position.character += change.characters;
    position.index += change.characters;
  }
  return position;
}
