import type { Gcdata } from './GameChanger.js';
import { assert } from './assert.js';
import { Crashlands2 } from './cl2.types.auto.js';
import type {
  BschemaBsArrayElement,
  BschemaEnum,
  BschemaMoteId,
  BschemaObject,
} from './types.js';
import { resolvePointerInSchema } from './util.js';

export function getMoteLists(packed: Gcdata) {
  const allowedSpeakers = getAllowedSpeakers(packed);
  assert(
    allowedSpeakers.length > 0,
    'Should have at least one allowed speaker mote',
  );

  const allowedGivers = getAllowedGivers(packed);
  assert(
    allowedGivers.length > 0,
    'Should have at least one allowed giver mote',
  );

  const storylines =
    packed.listMotesBySchema<Crashlands2.Schemas['cl2_storyline']>(
      'cl2_storyline',
    );
  assert(storylines.length > 0, 'Should have at least one storyline mote');

  const quests =
    packed.listMotesBySchema<Crashlands2.Schemas['cl2_quest']>('cl2_quest');
  assert(quests.length > 0, 'Should have at least one quest mote');

  return {
    allowedSpeakers,
    allowedGivers,
    storylines,
    quests,
  };
}

function getAllowedSpeakers(packed: Gcdata) {
  const speakerSubchema = resolvePointerInSchema(
    ['quest_start_moments', 'anykey', 'element', 'speech', 'speaker'],
    {
      schema_id: 'cl2_quest',
      data: {
        quest_start_moments: {
          anykey: {
            element: {
              style: 'Dialogue',
              speech: {
                speaker: 'any',
              },
            },
          },
        },
      },
    } as any,
    packed,
  ) as BschemaMoteId;
  return packed.listMotesBySchema(
    ...speakerSubchema.formatProperties!.allowSchemas!,
  );
}

export function getRequirementQuestStatuses(packed: Gcdata): string[] {
  const subschema = resolvePointerInSchema(
    ['quest_start_requirements', 'anykey', 'element', 'quest_status'],
    {
      schema_id: 'cl2_quest',
      data: {
        quest_start_requirements: {
          anykey: {
            element: {
              style: 'Quest',
            },
          },
        },
      },
    } as any,
    packed,
  ) as BschemaEnum;

  const statuses = subschema.enum;

  assert(statuses.length, 'Should have required quest statuses');
  return statuses as string[];
}

export function getRequirementStyleNames(packed: Gcdata): string[] {
  const subschema = resolvePointerInSchema(
    ['quest_start_requirements', 'anykey'],
    {
      schema_id: 'cl2_quest',
      data: {
        quest_start_requirements: {
          anykey: {
            element: {},
          },
        },
      },
    } as any,
    packed,
  ) as BschemaBsArrayElement;
  const element = subschema.properties.element as { oneOf: BschemaObject[] };
  const styles = element.oneOf.map((s) => (s.properties!.style as any).bConst);

  assert(styles.length, 'Should have moment styles');
  return styles as string[];
}

export function getMomentStyleNames(packed: Gcdata): string[] {
  const subschema = resolvePointerInSchema(
    ['quest_start_moments', 'anykey'],
    {
      schema_id: 'cl2_quest',
      data: {
        quest_start_moments: {
          anykey: {
            element: {},
          },
        },
      },
    } as any,
    packed,
  ) as BschemaBsArrayElement;
  const element = subschema.properties.element as { oneOf: BschemaObject[] };
  const styles = element.oneOf.map((s) => (s.properties!.style as any).bConst);

  assert(styles.length, 'Should have moment styles');
  return styles as string[];
}

function getAllowedGivers(packed: Gcdata) {
  const giverSubchema = resolvePointerInSchema(
    'quest_giver/item',
    {
      schema_id: 'cl2_quest',
      data: {
        quest_giver: {
          item: {
            item: 'any',
          },
        },
      },
    } as any,
    packed,
  ) as BschemaMoteId;
  return packed.listMotesBySchema(
    ...giverSubchema.formatProperties!.allowSchemas!,
  );
}

export function isEmoteMoment<T extends Crashlands2.QuestMoment>(
  moment: T,
): moment is T & { style: 'Emote' } {
  return moment.style === 'Emote';
}
