import { pathy } from '@bscotch/pathy';
import { GameChanger } from './GameChanger.js';
import { assert } from './assert.js';
import { parseStringifiedQuest } from './cl2.quest.parse.js';
import { stringifyQuest } from './cl2.quest.stringify.js';
import { Crashlands2 } from './cl2.types.auto.js';
import { bsArrayToArray, isQuestMote } from './helpers.js';

describe('Cl2 Quests', function () {
  it('can convert a quest mote to a text format', async function () {
    const packed = await GameChanger.from('Crashlands2');
    assert(packed, 'Packed data should be loaded');

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
      const results = parseStringifiedQuest(asText, packed);
      if (results.diagnostics.length > 0) {
        console.error('Quest not parsed:', quest.id, quest.data.name);
        console.error(results.diagnostics.map((d) => d.message).join('\n'));
      }
      assert(results.diagnostics.length === 0, 'Should have no errors');
    }
  });
});
