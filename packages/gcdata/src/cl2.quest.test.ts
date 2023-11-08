import { pathy } from '@bscotch/pathy';
import { ok } from 'node:assert';
import { GameChanger } from './GameChanger.js';
import { assert } from './assert.js';
import { parseStringifiedQuest } from './cl2.quest.parse.js';
import { stringifyQuest } from './cl2.quest.stringify.js';
import {
  BsArrayItem,
  bsArrayToArray,
  isQuestMote,
  updateBsArrayOrder,
} from './helpers.js';
import { Crashlands2 } from './types.cl2.js';

const sampleQuestMoteId = 'k04f0p';

describe('Cl2 Quests', function () {
  it('can update order fields for a BsArray', function () {
    let sorted: BsArrayItem[] = [
      { element: 'a' },
      { element: 'b', order: 3 },
      { element: 'c', order: 10 },
      { element: 'd' },
      { element: 'e', order: 7 },
      { element: 'f', order: 1 },
    ];
    updateBsArrayOrder(sorted);
    ok(sorted[0].order === -2);
    ok(sorted[1].order === 3);
    ok(sorted[2].order === 5);
    ok(sorted[3].order === 6);
    ok(sorted[4].order === 7);
    ok(sorted[5].order === 12);

    sorted = [
      { element: 'a' },
      { element: 'b' },
      { element: 'c' },
      { element: 'd' },
      { element: 'e' },
      { element: 'f' },
    ];
    updateBsArrayOrder(sorted);
    ok(sorted[0].order === 5);
    ok(sorted[1].order === 10);
    ok(sorted[2].order === 15);
    ok(sorted[3].order === 20);
    ok(sorted[4].order === 25);
    ok(sorted[5].order === 30);

    sorted = [
      { element: 'a', order: 30 },
      { element: 'b', order: 25 },
      { element: 'c', order: 20 },
      { element: 'd', order: 15 },
      { element: 'e', order: 10 },
      { element: 'f', order: 5 },
    ];
    updateBsArrayOrder(sorted);
    ok(sorted[0].order === 20);
    ok(sorted[1].order === 25);
    ok(sorted[2].order === 30);
    ok(sorted[3].order === 35);
    ok(sorted[4].order === 40);
    ok(sorted[5].order === 45);

    sorted = [
      { element: 'a' },
      { element: 'b', order: 3 },
      { element: 'c' },
      { element: 'd' },
      { element: 'e' },
      { element: 'f' },
      { element: 'g', order: 1 },
    ];
    updateBsArrayOrder(sorted);
    ok(sorted[0].order === -9);
    ok(sorted[1].order === -4);
    ok(sorted[2].order === -3);
    ok(sorted[3].order === -2);
    ok(sorted[4].order === -1);
    ok(sorted[5].order === 0);
    ok(sorted[6].order === 1);
  });

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
      const results = parseStringifiedQuest(asText, packed);
      if (results.diagnostics.length > 0) {
        console.error(results.diagnostics.map((d) => d.message).join('\n'));
      }
      assert(results.diagnostics.length === 0, 'Should have no errors');
    }
  });
});
