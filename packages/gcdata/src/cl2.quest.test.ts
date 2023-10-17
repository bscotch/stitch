import { pathy } from '@bscotch/pathy';
import { Packed } from './Packed.js';
import { assert } from './assert.js';
import { questMoteToText } from './cl2.quest.js';
import { isQuestMote } from './helpers.js';

const sampleYypPath = pathy(
  '../../../crashlands-2/Crashlands2/Crashlands2.yyp',
);
const sampleQuestMoteId = 'k04f0p';

describe('Cl2 Quests', function () {
  it('can convert a quest mote to a text format', async function () {
    const packed = await Packed.from(sampleYypPath);
    assert(packed, 'Packed data should be loaded');

    const quest = packed.getMote(sampleQuestMoteId);
    assert(isQuestMote(quest), 'Mote should be a quest');

    await pathy('tmp.cl2_quest').write(questMoteToText(quest, packed));
  });
});
