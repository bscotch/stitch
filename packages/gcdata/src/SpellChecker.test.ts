import { checker } from "./SpellChecker.js";

describe('SpellChecker', function(){
    it('can spellcheck', function(){
      console.log('COLOUR', checker.suggest('COLOUR'));
    });
})