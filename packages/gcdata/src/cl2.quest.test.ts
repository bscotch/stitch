import { pathy } from '@bscotch/pathy';
import { Packed } from './Packed.js';
import { assert } from './assert.js';
import { parseStringifiedMote } from './cl2.quest.js';
import { stringifyMote } from './cl2.quest.stringify.js';
import { bsArrayToArray, isQuestMote } from './helpers.js';
import { Crashlands2 } from './types.cl2.js';

const sampleYypPath = pathy(
  '../../../crashlands-2/Crashlands2/Crashlands2.yyp',
);
const sampleQuestMoteId = 'k04f0p';

describe('Cl2 Quests', function () {
  it('can convert a quest mote to a text format', async function () {
    const packed = await Packed.from(sampleYypPath);
    assert(packed, 'Packed data should be loaded');

    // Find a quest that gives items
    const quests =
      packed.listMotesBySchema<Crashlands2.Schemas['cl2_quest']>('cl2_quest');
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
        q.data.quest_start_log &&
        q.data.objectives &&
        (q.data.quest_start_requirements || q.data.quest_end_requirements),
    );

    // const quest = packed.getMote(sampleQuestMoteId);
    assert(isQuestMote(quest), 'Mote should be a quest');

    await pathy('tmp.cl2_quest').write(stringifyMote(quest, packed));
  });

  it('can convert quests to text and back without error', async function () {
    const packed = await Packed.from(sampleYypPath);
    assert(packed, 'Packed data should be loaded');
    const quests =
      packed.listMotesBySchema<Crashlands2.Schemas['cl2_quest']>('cl2_quest');
    for (const quest of quests) {
      const asText = stringifyMote(quest, packed);
      const results = parseStringifiedMote(asText, quest, packed);
      if (results.diagnostics.length > 0) {
        console.error(results.diagnostics.map((d) => d.message).join('\n'));
      }
      assert(results.diagnostics.length === 0, 'Should have no errors');
    }
  });
});
