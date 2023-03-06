import { expect } from 'chai';
import { CharacterStream } from './parser.character.js';

const sample = `
  // This is a comment
  let x = 10;
  function(){
    return x;
  }
`;

describe('Input Stream', function () {
  it('can stream an input', function () {
    const sampleChars = sample.split('');
    const stream = new CharacterStream(sample);
    let i = 0;
    let newlines = 0;
    let priorLocation = stream.location;
    for (const ch of stream) {
      if (ch === '\n') {
        newlines++;
      }
      expect(ch).to.equal(sampleChars[i]);
      expect(stream.location.idx).to.equal(i + 1);
      expect(stream.location.line).to.equal(newlines + 1);
      for (let j = i - 1; j >= 0; j--) {
        if (sampleChars[j] === '\n' || j === 0) {
          expect(priorLocation.col).to.equal(i - j - 1);
          break;
        }
      }
      i++;
      priorLocation = stream.location;
    }
  });
});
