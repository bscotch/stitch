import type { Gcdata } from './GameChanger.js';
import type { Crashlands2 } from './cl2.types.auto.js';
import type { Mote } from './types.js';

export const storylineSchemaId = 'cl2_storyline';

export type StorylineData = Crashlands2.Schemas['cl2_storyline'];
export type StorylineMote = Mote<StorylineData>;

export function listStorylines(gcData: Gcdata): StorylineMote[] {
  return gcData.listMotesBySchema<StorylineData>(storylineSchemaId);
}
