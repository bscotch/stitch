import { undent } from '@bscotch/utility';
import fs from 'fs/promises';
import { GmlLexer } from './lexer.js';

describe('Lexer', function () {
  it('can lex strings', function () {
    const sample = undent`
      "hello"
      @"world"
      @'singlez'
      @"multi
      line
      one!"
    `;
    const result = GmlLexer.tokenize(sample);
    if (result.errors.length) {
      console.dir(result, { depth: null });
      throw new Error('Lexer failed to lex sample file: ' + sample);
    }
  });

  it('can lex templates', function () {
    const sample = '$"a template {woo+3}!"';
    const result = GmlLexer.tokenize(sample);
    if (result.errors.length) {
      console.dir(result, { depth: null });
      throw new Error('Lexer failed to lex sample file: ' + sample);
    }
  });

  it('can lex sample files', async function () {
    const samples = await fs.readdir('./samples');
    for (const sample of samples) {
      const filePath = `./samples/${sample}`;
      const code = await fs.readFile(filePath, 'utf-8');
      const result = GmlLexer.tokenize(code);
      if (result.errors.length) {
        console.dir(result, { depth: null });
        throw new Error('Lexer failed to lex sample file: ' + filePath);
      }
    }
  });
});
