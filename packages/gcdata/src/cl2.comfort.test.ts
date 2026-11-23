import { describe, it } from 'node:test';
import { pathy } from '@bscotch/pathy';
import { GameChanger } from './GameChanger.ts';
import { skipWithoutCl2Data } from './testing.ts';
import { assert } from './assert.ts';
import { parseStringifiedComfort, stringifyComfort } from './cl2.comfort.ts';
import { listComforts } from './cl2.comfort.types.ts';
import { comfortSchemaId } from './cl2.shared.types.ts';

describe('Cl2 Comforts', { skip: skipWithoutCl2Data }, function () {
  it('can convert a comfort mote to a text format', async function () {
    const packed = await GameChanger.from('Crashlands2');
    assert(packed, 'Packed data should be loaded');

    // Find a quest that gives items
    const storylines = listComforts(packed.working);

    await pathy(`tmp.${comfortSchemaId}`).write(
      stringifyComfort(storylines[0], packed),
    );
  });

  it('can convert comforts to text and back without error', async function () {
    const packed = await GameChanger.from('Crashlands2');
    assert(packed, 'Packed data should be loaded');
    const comforts = listComforts(packed.working);
    for (const storyline of comforts) {
      const asText = stringifyComfort(storyline, packed);
      console.log(asText);
      const results = parseStringifiedComfort(asText, packed);
      if (results.diagnostics.length > 0) {
        console.error('Comfort not parsed:', storyline.id, storyline.data.name);
        console.error(results.diagnostics.map((d) => d.message).join('\n'));
      }
      assert(results.diagnostics.length === 0, 'Should have no errors');
    }
  });
});
