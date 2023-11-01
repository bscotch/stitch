import type { Gcdata } from './GameChanger.js';
import { assert } from './assert.js';
import { Crashlands2 } from './types.cl2.js';
import type {
  BschemaBsArrayElement,
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

  const emojis =
    packed.listMotesBySchema<Crashlands2.Schemas['cl2_emoji']>('cl2_emoji');
  assert(emojis.length > 0, 'Should have at least one emoji mote');

  return {
    allowedSpeakers,
    allowedGivers,
    storylines,
    emojis,
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
