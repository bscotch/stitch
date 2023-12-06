import { assert } from './assert.js';
import type { Crashlands2 } from './cl2.types.auto.js';
import { Position } from './types.editor.js';
import type { BschemaBsArray, BschemaObject, Mote } from './types.js';

export const ORDER_INCREMENT = 5;

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

export function updateBsArrayOrder(sorted: BsArrayItem[]) {
  // BsArrayItems have an 'order' field, which must be incrementing for
  // their sorted order. We want to minimize changes to "order" values,
  // so we need to do some fancy logic.
  // Entries in the sorted array might not have their order set,
  // and entries that are supposed to be adjacent might have things in
  // the wrong order.
  // The first step is to ensure that all * existing *
  // order values are properly incrementing.
  const sortedWithDefinedOrder = sorted.filter(
    (s) => s.order !== undefined,
  ) as Required<BsArrayItem>[];
  if (sortedWithDefinedOrder.length > 1) {
    for (const [index, item] of sortedWithDefinedOrder.entries()) {
      const priorItem: Required<BsArrayItem> | undefined =
        sortedWithDefinedOrder[index - 1];
      const nextItem: Required<BsArrayItem> | undefined =
        sortedWithDefinedOrder[index + 1];
      const isFirstItem = index === 0;
      const isLastItem = index === sortedWithDefinedOrder.length - 1;

      if (isFirstItem) {
        // Just make sure this value is less than the next one
        if (item.order >= nextItem.order) {
          item.order = nextItem.order - ORDER_INCREMENT;
        }
      } else if (isLastItem) {
        // Just make sure this value is greater than the prior one
        if (item.order <= priorItem.order) {
          item.order = priorItem.order + ORDER_INCREMENT;
        }
      } else if (item.order > priorItem.order && item.order < nextItem.order) {
        // Then we're already in between the values. Move along!
        continue;
      } else if (priorItem.order < nextItem.order) {
        // Then the neighbors are in the right order, just go between them
        item.order = (priorItem.order + nextItem.order) / 2;
      } else if (item.order > priorItem.order) {
        // Then the next item is a problem, but this one isn't!
        continue;
      } else {
        item.order = priorItem.order + ORDER_INCREMENT;
      }
    }
  } else if (sortedWithDefinedOrder.length === 0) {
    // Then just iterate through and add values
    for (const [index, item] of sorted.entries()) {
      item.order = (index + 1) * ORDER_INCREMENT;
    }
    return sorted;
  }

  // Next we fill in the gaps between defined order values.
  for (const [index, item] of sorted.entries()) {
    if (item.order !== undefined) continue;
    const isLastItem = index === sorted.length - 1;

    /** Must be defined, except for the case where the 0th element has  */
    let priorOrder = sorted[index - 1]?.order;

    if (isLastItem) {
      // Then we're at the end. Just add 5 to the last one.
      item.order = (priorOrder || 0) + ORDER_INCREMENT;
      continue;
    }

    let nextOrder: number | undefined;
    let numMissing = 1;
    for (let j = index + 1; j < sorted.length; j++) {
      if (sorted[j].order !== undefined) {
        nextOrder = sorted[j].order;
        break;
      }
      numMissing++;
    }
    if (nextOrder === undefined) {
      // To get to this case, we must have had at least 1 defined
      // order. And it isn't later! Therefore priorOrder must be defined.
      item.order = priorOrder! + ORDER_INCREMENT;
    } else if (priorOrder === undefined) {
      item.order = nextOrder - ORDER_INCREMENT * numMissing;
    } else {
      const increment = (nextOrder - priorOrder) / (numMissing + 1);
      item.order = priorOrder + increment;
    }
  }

  // Make sure the order values are INCREMENTING and EXIST
  for (const [index, item] of sorted.entries()) {
    assert(
      item.order !== undefined,
      `Order value should be defined at this point`,
    );
    if (index > 0) {
      assert(
        item.order > sorted[index - 1].order!,
        `Order values should be incrementing`,
      );
    }
  }
  return sorted;
}

/**
 * Given a moteId (or a mote), return `@${moteId}`.
 */
export function toMoteTag(item: string | { id: string } | undefined): string {
  assert(
    item && (typeof item === 'string' || 'id' in item),
    `ID must be a string or Mote, instead got ${item}`,
  );
  const idStr = typeof item === 'string' ? item : item.id;
  return `@${idStr}`;
}
/**
 * Given a BschemaArray element ID (or an element), return `#${elementId}`.
 */
export function toArrayTag(item: string | { id: string }): string {
  assert(
    typeof item === 'string' || 'id' in item,
    'ID must be a string or Mote',
  );
  const idStr = typeof item === 'string' ? item : item.id;
  return `#${idStr}`;
}
