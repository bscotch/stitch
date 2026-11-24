import fs from 'node:fs/promises';
import type { SpineAnimation, SpineJson } from './spine.types.ts';
import { assert } from './util.ts';
export type * from './spine.types.ts';

export interface SpineSummary<
  AnimationName extends string = string,
  EventName extends string = string,
> {
  skinNames: string[];
  eventNames: EventName[];
  slotNames: string[];
  animations: {
    name: AnimationName;
    duration: number;
    events: { time: number; name: EventName }[];
  }[];
}

/** Read and validate a Spine JSON file (as used by Spine sprites). */
export async function readSpineJson<
  AnimationName extends string = string,
  SlotName extends string = string,
  BoneName extends string = string,
  EventName extends string = string,
  AttachmentName extends string = string,
>(
  file: string,
): Promise<
  SpineJson<AnimationName, SlotName, BoneName, EventName, AttachmentName>
> {
  assert(file.endsWith('.json'), `Spine file must be a JSON file: ${file}`);
  const content = JSON.parse(await fs.readFile(file, 'utf8'));
  const isObject = (v: unknown) =>
    v === undefined ||
    (typeof v === 'object' && v !== null && !Array.isArray(v));
  const isArray = (v: unknown) => v === undefined || Array.isArray(v);
  assert(
    content?.skeleton?.spine,
    `Spine file does not have a valid 'skeleton/spine' path: ${file}`,
  );
  assert(isArray(content.bones), `Spine file has invalid 'bones': ${file}`);
  assert(isArray(content.slots), `Spine file has invalid 'slots': ${file}`);
  assert(isArray(content.skins), `Spine file has invalid 'skins': ${file}`);
  assert(isObject(content.events), `Spine file has invalid 'events': ${file}`);
  assert(
    isObject(content.animations),
    `Spine file has invalid 'animations': ${file}`,
  );
  return content;
}

/** A simplified summary of a Spine file's content, e.g. for UIs */
export async function summarizeSpine<
  AnimationName extends string = string,
  EventName extends string = string,
>(file: string): Promise<SpineSummary<AnimationName, EventName>> {
  const content = await readSpineJson<AnimationName, string, string, EventName>(
    file,
  );
  const animations = content.animations || ({} as Record<string, never>);
  return {
    skinNames: content.skins?.map((skin) => skin.name) || [],
    eventNames: Object.keys(content.events || {}) as EventName[],
    slotNames: content.slots?.map((slot) => slot.name) || [],
    animations: (Object.keys(animations) as AnimationName[]).map((name) => {
      const animation: SpineAnimation = animations[name];
      return {
        name,
        duration: maxTime(animation),
        events: (animation.events || []) as {
          time: number;
          name: EventName;
        }[],
      };
    }),
  };
}

function maxTime(data: unknown, max = 0): number {
  if (typeof data !== 'object' || data === null) return max;
  if (Array.isArray(data)) {
    return data.reduce((m: number, d) => Math.max(m, maxTime(d, max)), max);
  }
  if ('time' in data && typeof data.time === 'number') {
    return Math.max(data.time, max);
  }
  return Object.values(data).reduce(
    (m: number, d) => Math.max(m, maxTime(d, max)),
    max,
  );
}
