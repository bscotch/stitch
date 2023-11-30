import { GameChanger } from './GameChanger.js';
import { SpellChecker } from './SpellChecker.js';
const checker = new SpellChecker((await GameChanger.from('Crashlands2'))!);
describe('SpellChecker', async function () {
  it('can spellcheck', function () {
    // console.log('COLOUR', checker.suggest('COLOUR'));
  });
});
