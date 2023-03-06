import { undent } from '@bscotch/utility';
import { expect } from 'chai';
import { CharacterStream } from './parser.character.js';
import { TokenStream } from './parser.token.js';
import { TokenKind } from './parser.types.js';

describe('Token Stream', function () {
  it('can create a valid token stream', function () {
    const complexString = `"This, is a // \\"string\\"!"`;
    const sample = undent`
      // This is a comment
      var x = 11;
      /** This is a doc comment */
      /// So is this!
      function(){
        return x;
      }

      var y = ${complexString} ;
      var hello_world = -10.4
    `;
    const charStream = new CharacterStream(sample);
    const tokenStream = new TokenStream(charStream);
    const tokens = [...tokenStream];

    // Check the first few
    expect(tokens[0]).to.eql({
      type: TokenKind.Keyword,
      value: 'var',
      location: { idx: 21, line: 2, col: 0 },
    });
    expect(tokens[1]).to.eql({
      type: TokenKind.Identifier,
      value: 'x',
      location: { idx: 25, line: 2, col: 4 },
    });
    expect(tokens[2]).to.eql({
      type: TokenKind.Equals,
      value: '=',
      location: { idx: 27, line: 2, col: 6 },
    });

    // Check for some specific entries
    expect(tokens.find((t) => t!.value === '10')).not.to.exist;
    expect(tokens.find((t) => t!.value === '10.4')).to.exist;
    expect(tokens.find((t) => t!.value === complexString)).to.exist;
  });
});
