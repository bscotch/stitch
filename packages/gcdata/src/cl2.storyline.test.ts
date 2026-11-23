import { describe, it } from 'node:test';
import { pathy } from '@bscotch/pathy';
import { GameChanger } from './GameChanger.ts';
import { skipWithoutCl2Data } from './testing.ts';
import { assert } from './assert.ts';
import { storylineSchemaId } from './cl2.shared.types.ts';
import {
  parseStringifiedStoryline,
  stringifyStoryline,
} from './cl2.storyline.ts';
import { listStorylines } from './cl2.storyline.types.ts';

describe('Cl2 Storylines', { skip: skipWithoutCl2Data }, function () {
  it('can convert a storyline mote to a text format', async function () {
    const packed = await GameChanger.from('Crashlands2');
    assert(packed, 'Packed data should be loaded');

    // Find a quest that gives items
    const storylines = listStorylines(packed.working);

    await pathy(`tmp.${storylineSchemaId}`).write(
      stringifyStoryline(storylines[0], packed),
    );
  });

  it('can convert storylines to text and back without error', async function () {
    const packed = await GameChanger.from('Crashlands2');
    assert(packed, 'Packed data should be loaded');
    const storylines = listStorylines(packed.working);
    for (const storyline of storylines) {
      const asText = stringifyStoryline(storyline, packed);
      const results = parseStringifiedStoryline(asText, packed);
      if (results.diagnostics.length > 0) {
        console.error(
          'Storyline not parsed:',
          storyline.id,
          storyline.data.name,
        );
        console.error(results.diagnostics.map((d) => d.message).join('\n'));
      }
      assert(results.diagnostics.length === 0, 'Should have no errors');
    }
  });
});
