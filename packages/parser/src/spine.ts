import { pathy, type Pathy } from '@bscotch/pathy';
import { SpineAnimation, SpineJson } from './spine.types.js';
import { assert } from './util.js';

export interface SpineSummary<
  AnimationName extends string = string,
  EventName extends string = string,
> {
  skinNames: string[];
  eventNames: EventName[];
  animations: {
    name: AnimationName;
    duration: number;
    events: {
      time: number;
      name: EventName;
    }[];
  }[];
}

export class Spine<
  AnimationName extends string = string,
  SlotName extends string = string,
  BoneName extends string = string,
  EventName extends string = string,
  AttachmentName extends string = string,
> {
  path: Pathy;
  protected _content?: SpineJson<
    AnimationName,
    SlotName,
    BoneName,
    EventName,
    AttachmentName
  >;

  constructor(path: string | Pathy) {
    this.path = pathy(path);
    assert(
      this.path.hasExtension('json'),
      `Spine file must be a JSON file: ${this.path}`,
    );
  }

  /**
   * Compute a simplified summary of the Spine content
   * for use in the Sprite Editor UI.
   */
  async summarize(): Promise<SpineSummary<AnimationName, EventName>> {
    const content = await this.getContent();
    return {
      skinNames: content.skins?.map((skin) => skin.name) || [],
      eventNames: Object.keys(content.events || {}) as EventName[],
      animations: Object.keys(content.animations || {}).map((animationName) => {
        const animation: SpineAnimation =
          content.animations![animationName as AnimationName];
        const summary = {
          name: animationName,
          duration: recursivelyFindMaxTime(animation),
          events: animation.events || [],
        } as {
          name: AnimationName;
          duration: number;
          events: {
            time: number;
            name: EventName;
          }[];
        };
        return summary;
      }),
    };
  }

  async getContent(): Promise<
    SpineJson<AnimationName, SlotName, BoneName, EventName, AttachmentName>
  > {
    if (!this._content) {
      await this.reload();
    }
    return this._content!;
  }

  async reload(): Promise<void> {
    assert(await this.path.exists(), `Spine file does not exist: ${this.path}`);
    const content =
      await this.path.read<
        SpineJson<AnimationName, SlotName, BoneName, EventName, AttachmentName>
      >();
    assert(
      content && content.skeleton && content.skeleton.spine,
      `Spine file does not have a valid 'skeleton/spine' path: ${this.path}`,
    );
    assert(
      !content.bones || Array.isArray(content.bones),
      `Spine file has invalid 'bones' data: ${this.path}`,
    );
    assert(
      !content.slots || Array.isArray(content.slots),
      `Spine file has invalid 'slots' data: ${this.path}`,
    );
    assert(
      !content.skins || Array.isArray(content.skins),
      `Spine file has invalid 'skins' data: ${this.path}`,
    );
    assert(
      !content.events ||
        (typeof content.events === 'object' && !Array.isArray(content.events)),
      `Spine file has invalid 'events' data: ${this.path}`,
    );
    assert(
      !content.animations ||
        (typeof content.animations === 'object' &&
          !Array.isArray(content.animations)),
      `Spine file has invalid 'animations' data: ${this.path}`,
    );
    this._content = content;
  }
}

function recursivelyFindMaxTime(data: SpineAnimation, current_max = 0): number {
  if (typeof data !== 'object' || data === null) {
    return current_max;
  }
  if (Array.isArray(data)) {
    return Math.max(
      ...data.map((d) => recursivelyFindMaxTime(d, current_max)),
      current_max,
    );
  }
  if ('time' in data && typeof data.time === 'number') {
    return Math.max(data.time, current_max);
  }
  return Math.max(
    ...Object.values(data).map((d) =>
      recursivelyFindMaxTime(d as any, current_max),
    ),
    current_max,
  );
}
