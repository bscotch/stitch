import { pathy } from '@bscotch/pathy';
import { GameChanger } from './Packed.js';
import { assert } from './assert.js';
import { parseStringifiedQuest } from './cl2.quest.parse.js';
import { stringifyQuest } from './cl2.quest.stringify.js';
import { bsArrayToArray, isQuestMote } from './helpers.js';
import { Crashlands2 } from './types.cl2.js';
import { computeMotePointersFromSchema } from './util.js';

const sampleQuestMoteId = 'k04f0p';

describe('Cl2 Quests', function () {
  it('can convert a quest mote to a text format', async function () {
    const packed = await GameChanger.from('Crashlands2');
    assert(packed, 'Packed data should be loaded');

    console.log(
      computeMotePointersFromSchema(
        packed.working,
        packed.working.getSchema('cl2_quest')!,
        new Set(),
        true,
      ),
    );

    // Find a quest that gives items
    const quests =
      packed.working.listMotesBySchema<Crashlands2.Schemas['cl2_quest']>(
        'cl2_quest',
      );
    const quest = quests.find(
      (q) =>
        (bsArrayToArray(q.data.quest_start_moments!).find(
          (m) => m.element?.style === 'Gain Item',
        ) ||
          bsArrayToArray(q.data.quest_end_moments!).find(
            (m) => m.element?.style === 'Gain Item',
          )) &&
        (bsArrayToArray(q.data.quest_start_moments!).find(
          (m) => m.element?.style === 'Drop Item',
        ) ||
          bsArrayToArray(q.data.quest_end_moments!).find(
            (m) => m.element?.style === 'Drop Item',
          )) &&
        Object.keys(q.data.clues || {}).length > 0 &&
        q.data.quest_start_log &&
        q.data.objectives &&
        (q.data.quest_start_requirements || q.data.quest_end_requirements),
    );

    // const quest = packed.getMote(sampleQuestMoteId);
    assert(isQuestMote(quest), 'Mote should be a quest');

    await pathy('tmp.cl2_quest').write(stringifyQuest(quest, packed));
  });

  it('can convert quests to text and back without error', async function () {
    const packed = await GameChanger.from('Crashlands2');
    assert(packed, 'Packed data should be loaded');
    const quests =
      packed.working.listMotesBySchema<Crashlands2.Schemas['cl2_quest']>(
        'cl2_quest',
      );
    for (const quest of quests) {
      const asText = stringifyQuest(quest, packed);
      const results = parseStringifiedQuest(asText, quest.id, packed);
      if (results.diagnostics.length > 0) {
        console.error(results.diagnostics.map((d) => d.message).join('\n'));
      }
      assert(results.diagnostics.length === 0, 'Should have no errors');
    }
  });
});
