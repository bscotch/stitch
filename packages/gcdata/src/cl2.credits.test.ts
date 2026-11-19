import { describe, it } from 'node:test';
import { pathy } from '@bscotch/pathy';
import { GameChanger } from './GameChanger.ts';
import { assert } from './assert.ts';
import { parseStringifiedCredits } from './cl2.credits.parse.ts';
import { stringifyCredits } from './cl2.credits.stringify.ts';
import { listCredits } from './cl2.credits.types.ts';
import { creditsSchemaId } from './cl2.shared.types.ts';

describe('Cl2 Credits', function () {
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
    console.dir(results, { depth: null });
    if (results.diagnostics.length > 0) {
      console.error('Credits not parsed');
    }
    assert(results.diagnostics.length === 0, 'Should have no errors');
  });
});
