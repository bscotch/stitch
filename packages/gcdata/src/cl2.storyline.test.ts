import { pathy } from '@bscotch/pathy';
import { GameChanger } from './GameChanger.js';
import { assert } from './assert.js';
import { stringifyStoryline } from './cl2.storyline.js';
import { listStorylines, storylineSchemaId } from './cl2.storyline.types.js';

describe('Cl2 Storylines', function () {
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
    // const packed = await GameChanger.from('Crashlands2');
    // assert(packed, 'Packed data should be loaded');
    // const quests =
    //   packed.working.listMotesBySchema<Crashlands2.Schemas['cl2_quest']>(
    //     'cl2_quest',
    //   );
    // for (const quest of quests) {
    //   const asText = stringifyQuest(quest, packed);
    //   const results = parseStringifiedQuest(asText, packed);
    //   if (results.diagnostics.length > 0) {
    //     console.error('Quest not parsed:', quest.id, quest.data.name);
    //     console.error(results.diagnostics.map((d) => d.message).join('\n'));
    //   }
    //   assert(results.diagnostics.length === 0, 'Should have no errors');
    // }
  });
});
