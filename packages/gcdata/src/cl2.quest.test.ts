import { describe, it } from 'node:test';
import { pathy } from '@bscotch/pathy';
import { GameChanger } from './GameChanger.ts';
import { assert } from './assert.ts';
import { parseStringifiedQuest } from './cl2.quest.parse.ts';
import { stringifyQuest } from './cl2.quest.stringify.ts';
import { isQuestMote } from './cl2.quest.types.ts';
import type { Crashlands2 } from './cl2.types.auto.ts';
import { bsArrayToArray } from './helpers.ts';

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

  // Slow test, so skip this test when not in active dev
  it.skip(
    'can convert quests to text and back without error',
    { timeout: 20000 },
    async function () {
      const packed = await GameChanger.from('Crashlands2');
      assert(packed, 'Packed data should be loaded');
      const quests =
        packed.working.listMotesBySchema<Crashlands2.Schemas['cl2_quest']>(
          'cl2_quest',
        );
      for (const quest of quests) {
        const asText = stringifyQuest(quest, packed);
        const results = parseStringifiedQuest(asText, packed);
        if (
          results.diagnostics.length === 1 &&
          // EDGE CASE: Content team broke the rules they said
          // they'd follow, so we ended up with a few non-parseable quests.
          [
            'Emoji "indecipherable screaming" not found!',
            'Emoji "incomprehensible screaming" not found!',
            'Emoji "inscrutable screaming" not found!',
            'Emoji "indecipherable shrieks" not found!',
          ].includes(results.diagnostics[0].message)
        ) {
          continue;
        } else if (results.diagnostics.length > 0) {
          console.error('Quest not parsed:', quest.id, quest.data.name);
          console.error(results.diagnostics.map((d) => d.message).join('\n'));
        }
        assert(results.diagnostics.length === 0, 'Should have no errors');
      }
    },
  );
});
