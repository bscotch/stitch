import type { Packed } from './Packed.js';
import { assert } from './assert.js';
import { Crashlands2 } from './types.cl2.js';
import type { BschemaMoteId } from './types.js';
import { resolvePointerInSchema } from './util.js';

export function getMoteLists(packed: Packed) {
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
  const droppableItems = getDroppableItems(packed);
  assert(
    droppableItems.length > 0,
    'Should have at least one droppable item mote',
  );
  const droppers = getAllowedDroppers(packed);
  assert(droppers.length > 0, 'Should have at least one dropper mote');
  const gainableItems = getGainableItems(packed);
  assert(gainableItems.length > 0, 'Should have at least one gainable mote');

  return {
    allowedSpeakers,
    allowedGivers,
    storylines,
    droppers,
    droppableItems,
    gainableItems,
  };
}

function getAllowedSpeakers(packed: Packed) {
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

function getAllowedDroppers(packed: Packed) {
  const droppableSubchema = resolvePointerInSchema(
    [
      'quest_start_moments',
      'anykey',
      'element',
      'drops',
      'anykey',
      'element',
      'dropper',
    ],
    {
      schema_id: 'cl2_quest',
      data: {
        quest_start_moments: {
          anykey: {
            element: {
              style: 'Drop Item',
            },
          },
        },
      },
    } as any,
    packed,
  ) as BschemaMoteId;
  return packed.listMotesBySchema(
    ...droppableSubchema.formatProperties!.allowSchemas!,
  );
}

export function getMomentStyleSchema(style: string, packed: Packed) {
  const subschema = resolvePointerInSchema(
    ['quest_start_moments', 'anykey', 'element'],
    {
      schema_id: 'cl2_quest',
      data: {
        quest_start_moments: {
          anykey: {
            element: {
              style,
            },
          },
        },
      },
    } as any,
    packed,
  );
  return subschema;
}

function getGainableItems(packed: Packed) {
  const gainableSubchema = resolvePointerInSchema(
    [
      'quest_start_moments',
      'anykey',
      'element',
      'items',
      'anykey',
      'element',
      'key',
    ],
    {
      schema_id: 'cl2_quest',
      data: {
        quest_start_moments: {
          anykey: {
            element: {
              style: 'Gain Item',
            },
          },
        },
      },
    } as any,
    packed,
  ) as BschemaMoteId;
  return packed.listMotesBySchema(
    ...gainableSubchema.formatProperties!.allowSchemas!,
  );
}

function getDroppableItems(packed: Packed) {
  const droppableSubchema = resolvePointerInSchema(
    [
      'quest_start_moments',
      'anykey',
      'element',
      'drops',
      'anykey',
      'element',
      'items',
      'anykey',
      'element',
      'item_id',
    ],
    {
      schema_id: 'cl2_quest',
      data: {
        quest_start_moments: {
          anykey: {
            element: {
              style: 'Drop Item',
            },
          },
        },
      },
    } as any,
    packed,
  ) as BschemaMoteId;
  return packed.listMotesBySchema(
    ...droppableSubchema.formatProperties!.allowSchemas!,
  );
}

function getAllowedGivers(packed: Packed) {
  const giverSubchema = resolvePointerInSchema(
    ['quest_giver', 'item'],
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
