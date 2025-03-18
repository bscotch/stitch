import { pathy } from '@bscotch/pathy';
import { GameChanger } from './GameChanger.js';
import { assert } from './assert.js';
import { parseStringifiedCredits } from './cl2.credits.parse.js';
import { stringifyCredits } from './cl2.credits.stringify.js';
import { listCredits } from './cl2.credits.types.js';
import { creditsSchemaId } from './cl2.shared.types.js';

describe.only('Cl2 Credits', function () {
  it('can convert a credits mote to a text format', async function () {
    const packed = await GameChanger.from('Crashlands2');
    assert(packed, 'Packed data should be loaded');

    // Find a quest that gives items
    const [credits] = listCredits(packed.working);

    await pathy(`tmp.${creditsSchemaId}`).write(
      stringifyCredits(credits, packed),
    );
  });

  it('can convert credits to text and back without error', async function () {
    const packed = await GameChanger.from('Crashlands2');
    assert(packed, 'Packed data should be loaded');
    const [credits] = listCredits(packed.working);
    const asText = stringifyCredits(credits, packed);
    console.log(asText);
    const results = parseStringifiedCredits(asText, packed);
    if (results.diagnostics.length > 0) {
      console.error('Credits not parsed');
    }
    assert(results.diagnostics.length === 0, 'Should have no errors');
  });
});
