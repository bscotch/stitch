import { assert } from '@bscotch/utility/browser';
import { decode } from 'entities';
import { z } from 'zod';

export type ArrayItemScore<T> = (item: T, idx: number, items: T[]) => number;
export function findMax<T>(items: T[]): T;
export function findMax<T>(items: T[], byProperty: keyof T): T;
export function findMax<T>(items: T[], score: ArrayItemScore<T>): T;
export function findMax<T>(
  items: T[],
  propOrFunc?: ArrayItemScore<T> | keyof T,
): T {
  assert(items.length, 'Cannot find max of empty array');
  const score = (item: T, idx: number) =>
    propOrFunc === undefined
      ? item
      : typeof propOrFunc === 'function'
      ? propOrFunc(item, idx, items)
      : item[propOrFunc];
  let maxScore = score(items[0], 0);
  let maxIdx = 0;
  for (let i = 1; i < items.length; i++) {
    const itemScore = score(items[i], i);
    if (itemScore > maxScore) {
      maxScore = itemScore;
      maxIdx = i;
    }
  }
  return items[maxIdx];
}

export function htmlString() {
  return z.string().transform((s) => {
    if (!s || typeof s !== 'string') {
      return s;
    }
    // decode HTML entities
    s = decode(s.trim());
    // remove anchor targets
    s = s.replace(/\btarget=[^\s>]+/g, '');
    // remove excess space
    s = s.replace(/ +/g, ' ');
    s = s.replace(/\r/g, '');
    s = s.replace(/[\t ]*\n[\t ]*(\n[\t ]*)+/g, '\n\n');
    return s;
  });
}

export function countNonUnique(arr: any[]): number {
  return arr.length - new Set(arr).size;
}

export function isError(thing: unknown): thing is Error {
  return thing instanceof Error;
}
