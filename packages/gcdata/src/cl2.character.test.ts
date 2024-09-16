import { pathy } from '@bscotch/pathy';
import { GameChanger } from './GameChanger.js';
import { assert } from './assert.js';
import { stringifyCharacter } from './cl2.character.stringify.js';
import { isBuddyMote, listBuddies } from './cl2.character.types.js';

describe('Cl2 Characters', function () {
  it('can convert a Buddy mote to a text format', async function () {
    const packed = await GameChanger.from('Crashlands2');
    assert(packed, 'Packed data should be loaded');

    // Find a quest that gives items
    const buddies = listBuddies(packed.working);
    const buddy = buddies.find((q) => q.data.name.text === 'Graal');
    assert(isBuddyMote(buddy), 'Mote should be a Buddy');

    await pathy('tmp.cl2_character').write(stringifyCharacter(buddy, packed));
  });
});
