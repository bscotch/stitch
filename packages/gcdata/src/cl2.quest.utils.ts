import type { Packed } from './Packed.js';
import type { BschemaMoteId } from './types.js';
import { resolvePointerInSchema } from './util.js';

export function getAllowedSpeakers(packed: Packed) {
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

export function getAllowedGivers(packed: Packed) {
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
